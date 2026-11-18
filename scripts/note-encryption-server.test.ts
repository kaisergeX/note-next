import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {after, test} from 'node:test'
import {eq} from 'drizzle-orm'
import {openSearchTestDatabase} from './note-search-test-db'
import {usersTable} from '../db/schema/users'
import {notesTable} from '../db/schema/notes'
import {noteVaultsTable} from '../db/schema/note-vaults'
import {createNoteEncryptionRepository} from '../db/repositories/note-encryption'
import {createAccountRepository} from '../db/repositories/account'
import {createNoteRepository} from '../db/repositories/notes'
import {
  createAuthorization,
  openAuthorizationSigner,
  signReplacement,
} from '../lib/notes/encryption/authorization'
import {noteVaultOperationReceiptsTable} from '../db/schema/note-vault-operation-receipts'
import {
  encodeBase64url,
  encryptedNotePayloadSchema,
  vaultWrapperSchema,
} from '../lib/notes/encryption/protocol'
import {
  generatePassphraseSalt,
  generateRoot,
  importRoot,
  openNote,
  sealNote,
  unwrapRoot,
  wrapRoot,
} from '../lib/notes/encryption/crypto'
const {client, db} = await openSearchTestDatabase()
after(() => client.end())
const repo = createNoteEncryptionRepository(db)
const bytes = (n: number) =>
  encodeBase64url(crypto.getRandomValues(new Uint8Array(n)))
async function fixture() {
  const [owner] = await db
    .insert(usersTable)
    .values({name: 'Encryption test', email: `${randomUUID()}@test.invalid`})
    .returning()
  const vaultId = randomUUID(),
    setupId = randomUUID()
  const base = {
    version: 1,
    algorithm: 'AES-256-GCM',
    ownerId: owner.id,
    vaultId,
    wrapperId: randomUUID(),
    iv: bytes(12),
    ciphertext: bytes(48),
  }
  const primaryWrapper = {
    ...base,
    purpose: 'passphrase',
    profileId: 'pbkdf2-sha256-600000',
    passkeyBinding: null,
    salt: bytes(16),
  }
  const recoveryWrapper = {
    ...base,
    wrapperId: randomUUID(),
    purpose: 'recovery',
    profileId: null,
    passkeyBinding: null,
    salt: null,
  }
  const raw = generateRoot()
  const authorization = await createAuthorization(
    raw,
    owner.id,
    vaultId,
    setupId,
  )
  return {
    owner,
    raw,
    setup: {
      vaultId,
      setupId,
      primaryWrapper,
      recoveryWrapper,
      authorizationVersion: 1 as const,
      authorization,
    },
  }
}
function write(vaultId: string, noteId: string) {
  const envelope = () => ({
    salt: bytes(32),
    iv: bytes(12),
    ciphertext: bytes(32),
  })
  return {
    mode: 'encrypted',
    operation: 'create',
    expectedRevision: null,
    mutationId: randomUUID(),
    theme: null,
    payload: {
      version: 1,
      algorithm: 'AES-256-GCM',
      vaultId,
      noteId,
      contentId: randomUUID(),
      title: envelope(),
      body: envelope(),
    },
  }
}

test('signed replacement receipts preserve historical results, immutable state, and closed-rollout recovery', async () => {
  const f = await fixture()
  process.env.NOTE_ENCRYPTION_ENROLLMENT_ENABLED = 'true'
  assert.equal((await repo.setup(f.owner.id, f.setup)).status, 'success')
  const initial = await repo.getVault(f.owner.id)
  assert.ok(initial)
  const signer = await openAuthorizationSigner(
    f.raw,
    f.owner.id,
    f.setup.vaultId,
    f.setup.setupId,
    f.setup.authorization,
  )
  const sign = (revision: string, operationId: string = randomUUID()) =>
    signReplacement(signer, {
      ownerId: f.owner.id,
      vaultId: f.setup.vaultId,
      verifierId: f.setup.authorization.verifierId,
      expectedRevision: revision,
      operationId,
      primaryWrapper: vaultWrapperSchema.parse({
        ...f.setup.primaryWrapper,
        wrapperId: randomUUID(),
      }),
    })
  delete process.env.NOTE_ENCRYPTION_ENROLLMENT_ENABLED
  delete process.env.NOTE_ENCRYPTION_CREATION_ENABLED
  const a = await sign(initial.revision)
  assert.equal(
    (await repo.replacePrimary(f.owner.id, {...a, signature: bytes(64)}))
      .status,
    'invalid_input',
  )
  assert.equal(
    (await repo.replacePrimary(randomUUID(), a)).status,
    'invalid_input',
  )
  assert.equal(
    (await repo.replacePrimary(f.owner.id, {...a, extra: true})).status,
    'invalid_input',
  )
  assert.deepEqual(await repo.getVault(f.owner.id), initial)
  const acceptedA = await repo.replacePrimary(f.owner.id, a)
  assert.equal(acceptedA.status, 'success')
  const afterA = await repo.getVault(f.owner.id)
  assert.ok(afterA)
  assert.notEqual(afterA.revision, initial.revision)
  assert.equal(
    (await repo.replacePrimary(f.owner.id, await sign(initial.revision)))
      .status,
    'conflict',
  )
  const b = await sign(afterA.revision)
  assert.equal((await repo.replacePrimary(f.owner.id, b)).status, 'success')
  const afterB = await repo.getVault(f.owner.id)
  assert.ok(afterB)
  const retry = await repo.replacePrimary(f.owner.id, a)
  assert.equal(retry.status, 'success')
  if (!('receipt' in retry) || !retry.receipt || !('vault' in retry))
    throw Error('missing receipt')
  assert.equal(retry.receipt.appliedRevision, afterA.revision)
  assert.equal(retry.vault.revision, afterB.revision)
  assert.equal('alreadyApplied' in retry && retry.alreadyApplied, true)
  assert.equal(
    (
      await repo.replacePrimary(
        f.owner.id,
        await sign(afterB.revision, a.operationId),
      )
    ).status,
    'conflict',
  )
  assert.deepEqual(await repo.getVault(f.owner.id), afterB)
  for (const field of [
    'recoveryWrapper',
    'authorization',
    'authorizationVersion',
    'setupId',
  ] as const)
    assert.deepEqual(afterB[field], initial[field])
  const lookup = await repo.getOperation(f.owner.id, a.operationId)
  assert.ok('receipt' in lookup && lookup.receipt)
  assert.equal(
    (
      await repo.setup(f.owner.id, {
        ...f.setup,
        authorization: {...f.setup.authorization, signerId: randomUUID()},
      })
    ).status,
    'conflict',
  )
  const {
    authorization: _auth,
    authorizationVersion: _version,
    ...oldSetup
  } = f.setup
  assert.equal((await repo.setup(f.owner.id, oldSetup)).status, 'conflict')
  for (const patch of [
    {authorizationVersion: 0, authorization: null},
    {authorization: {...f.setup.authorization, signerId: randomUUID()}},
    {recoveryWrapper: {...f.setup.recoveryWrapper, wrapperId: randomUUID()}},
    {setupId: randomUUID()},
  ])
    await assert.rejects(
      db
        .update(noteVaultsTable)
        .set(patch)
        .where(eq(noteVaultsTable.id, f.setup.vaultId)),
    )
  await createAccountRepository(db).deleteAccount(f.owner.id)
  assert.deepEqual(
    await db
      .select()
      .from(noteVaultOperationReceiptsTable)
      .where(eq(noteVaultOperationReceiptsTable.vaultId, f.setup.vaultId)),
    [],
  )
})

test('legacy setup cannot enroll or bootstrap authorization; exact old retries and notes remain available', async () => {
  const f = await fixture()
  const {
    authorization: _auth,
    authorizationVersion: _version,
    ...oldSetup
  } = f.setup
  process.env.NOTE_ENCRYPTION_ENROLLMENT_ENABLED = 'true'
  assert.equal(
    (await repo.setup(f.owner.id, oldSetup)).status,
    'reload_required',
  )
  await db.insert(noteVaultsTable).values({
    id: f.setup.vaultId,
    ownerId: f.owner.id,
    setupId: f.setup.setupId,
    lastOperationId: f.setup.setupId,
    primaryWrapper: f.setup.primaryWrapper,
    recoveryWrapper: f.setup.recoveryWrapper,
  })
  const legacy = await repo.getVault(f.owner.id)
  assert.ok(legacy)
  assert.equal((await repo.setup(f.owner.id, oldSetup)).status, 'success')
  assert.equal((await repo.setup(f.owner.id, f.setup)).status, 'conflict')
  const signer = await openAuthorizationSigner(
    f.raw,
    f.owner.id,
    f.setup.vaultId,
    f.setup.setupId,
    f.setup.authorization,
  )
  const request = await signReplacement(signer, {
    ownerId: f.owner.id,
    vaultId: f.setup.vaultId,
    verifierId: f.setup.authorization.verifierId,
    expectedRevision: legacy.revision,
    operationId: randomUUID(),
    primaryWrapper: vaultWrapperSchema.parse(f.setup.primaryWrapper),
  })
  assert.equal(
    (await repo.replacePrimary(f.owner.id, request)).status,
    'disabled',
  )
  const noteId = randomUUID()
  process.env.NOTE_ENCRYPTION_CREATION_ENABLED = 'true'
  assert.equal(
    (await repo.write(f.owner.id, noteId, write(f.setup.vaultId, noteId)))
      .status,
    'success',
  )
  assert.ok(await repo.getNote(f.owner.id, noteId))
  assert.deepEqual(await repo.getVault(f.owner.id), legacy)
})
test('disabled enrollment, concurrent setup, exact lost acknowledgement with replacement unavailable', async () => {
  const f = await fixture()
  delete process.env.NOTE_ENCRYPTION_ENROLLMENT_ENABLED
  assert.equal((await repo.setup(f.owner.id, f.setup)).status, 'disabled')
  process.env.NOTE_ENCRYPTION_ENROLLMENT_ENABLED = 'true'
  const losing = {...f.setup, setupId: randomUUID()}
  const results = await Promise.all([
    repo.setup(f.owner.id, f.setup),
    repo.setup(f.owner.id, losing),
  ])
  assert.deepEqual(results.map((r) => r.status).sort(), ['conflict', 'success'])
  const vault = await repo.getVault(f.owner.id)
  assert.ok(vault)
  delete process.env.NOTE_ENCRYPTION_ENROLLMENT_ENABLED
  const winner = vault.setupId === f.setup.setupId ? f.setup : losing
  assert.equal((await repo.setup(f.owner.id, winner)).status, 'success')
  assert.equal('replacePrimary' in repo, true)
  assert.deepEqual(await repo.getVault(f.owner.id), vault)
})
test('closed enrollment preserves primary and recovery access to saved notes', async () => {
  const f = await fixture(),
    raw = generateRoot(),
    recoverySecret = generateRoot(),
    phrase = 'synthetic test passphrase'
  const enrollment = process.env.NOTE_ENCRYPTION_ENROLLMENT_ENABLED,
    creation = process.env.NOTE_ENCRYPTION_CREATION_ENABLED
  let primaryOpened: Uint8Array | undefined, recovered: Uint8Array | undefined
  try {
    process.env.NOTE_ENCRYPTION_ENROLLMENT_ENABLED = 'true'
    process.env.NOTE_ENCRYPTION_CREATION_ENABLED = 'true'
    const primaryWrapper = await wrapRoot(
      raw,
      {
        ...vaultWrapperSchema.parse(f.setup.primaryWrapper),
        salt: generatePassphraseSalt(),
      },
      phrase,
    )
    const recoveryWrapper = await wrapRoot(
      raw,
      vaultWrapperSchema.parse(f.setup.recoveryWrapper),
      recoverySecret,
    )
    const authorization = await createAuthorization(
      raw,
      f.owner.id,
      f.setup.vaultId,
      f.setup.setupId,
    )
    const setup = {...f.setup, primaryWrapper, recoveryWrapper, authorization}
    assert.equal((await repo.setup(f.owner.id, setup)).status, 'success')
    const before = await repo.getVault(f.owner.id)
    assert.ok(before)
    const noteId = randomUUID(),
      identity = {vaultId: f.setup.vaultId, noteId},
      content = {title: 'Saved encrypted title', content: '<p>Saved body</p>'},
      payload = await sealNote(
        await importRoot(raw),
        f.owner.id,
        {...identity, contentId: randomUUID()},
        content,
      )
    assert.equal(
      (
        await repo.write(f.owner.id, noteId, {
          ...write(f.setup.vaultId, noteId),
          payload,
        })
      ).status,
      'success',
    )
    delete process.env.NOTE_ENCRYPTION_ENROLLMENT_ENABLED
    delete process.env.NOTE_ENCRYPTION_CREATION_ENABLED
    assert.equal('replacePrimary' in repo, true)
    assert.equal((await repo.setup(f.owner.id, setup)).status, 'success')
    assert.equal(
      (
        await repo.setup(f.owner.id, {
          ...setup,
          setupId: randomUUID(),
        })
      ).status,
      'conflict',
    )
    assert.deepEqual(await repo.getVault(f.owner.id), before)
    primaryOpened = await unwrapRoot(primaryWrapper, phrase)
    recovered = await unwrapRoot(recoveryWrapper, recoverySecret)
    const note = await repo.getNote(f.owner.id, noteId)
    assert.ok(note)
    const savedPayload = encryptedNotePayloadSchema.parse(note.encryptedPayload)
    for (const opened of [primaryOpened, recovered]) {
      assert.deepEqual(
        await openNote(
          await importRoot(opened),
          f.owner.id,
          savedPayload,
          identity,
        ),
        content,
      )
    }
    assert.equal(
      (
        await repo.write(f.owner.id, noteId, {
          mode: 'encrypted',
          operation: 'save',
          mutationId: randomUUID(),
          expectedRevision: note.revision,
          payload,
          theme: null,
        })
      ).status,
      'success',
    )
    assert.deepEqual(await repo.getVault(f.owner.id), before)
    const recoveredSigner = await openAuthorizationSigner(
      recovered,
      f.owner.id,
      setup.vaultId,
      setup.setupId,
      authorization,
    )
    const replacementPhrase = 'synthetic replacement phrase'
    const replacement = await wrapRoot(
      recovered,
      {
        ...primaryWrapper,
        wrapperId: randomUUID(),
        salt: generatePassphraseSalt(),
      },
      replacementPhrase,
    )
    const intent = await signReplacement(recoveredSigner, {
      ownerId: f.owner.id,
      vaultId: setup.vaultId,
      verifierId: authorization.verifierId,
      expectedRevision: before.revision,
      operationId: randomUUID(),
      primaryWrapper: replacement,
    })
    assert.equal(
      (await repo.replacePrimary(f.owner.id, intent)).status,
      'success',
    )
    const after = await repo.getVault(f.owner.id)
    assert.ok(after)
    assert.deepEqual(after.recoveryWrapper, before.recoveryWrapper)
    assert.deepEqual(after.authorization, before.authorization)
    const newlyOpened = await unwrapRoot(
      vaultWrapperSchema.parse(after.primaryWrapper),
      replacementPhrase,
    )
    try {
      assert.deepEqual(
        await openNote(
          await importRoot(newlyOpened),
          f.owner.id,
          savedPayload,
          identity,
        ),
        content,
      )
    } finally {
      newlyOpened.fill(0)
    }
  } finally {
    raw.fill(0)
    recoverySecret.fill(0)
    primaryOpened?.fill(0)
    recovered?.fill(0)
    if (enrollment === undefined)
      delete process.env.NOTE_ENCRYPTION_ENROLLMENT_ENABLED
    else process.env.NOTE_ENCRYPTION_ENROLLMENT_ENABLED = enrollment
    if (creation === undefined)
      delete process.env.NOTE_ENCRYPTION_CREATION_ENABLED
    else process.env.NOTE_ENCRYPTION_CREATION_ENABLED = creation
  }
})

test('ciphertext create/save retries, owner and mode fences, tombstones, header-only list and account cleanup', async () => {
  const f = await fixture(),
    other = await fixture()
  process.env.NOTE_ENCRYPTION_ENROLLMENT_ENABLED = 'true'
  await repo.setup(f.owner.id, f.setup)
  const noteId = randomUUID(),
    request = write(f.setup.vaultId, noteId)
  delete process.env.NOTE_ENCRYPTION_CREATION_ENABLED
  assert.equal(
    (await repo.write(f.owner.id, noteId, request)).status,
    'disabled',
  )
  process.env.NOTE_ENCRYPTION_CREATION_ENABLED = 'true'
  const created = await repo.write(f.owner.id, noteId, request)
  assert.equal(created.status, 'success')
  const current = await repo.getNote(f.owner.id, noteId)
  assert.ok(current)
  assert.equal(current.title, null)
  assert.equal(current.content, null)
  delete process.env.NOTE_ENCRYPTION_CREATION_ENABLED
  assert.equal(
    (await repo.write(f.owner.id, noteId, request)).status,
    'success',
  )
  assert.equal(await repo.getNote(other.owner.id, noteId), null)
  assert.equal(
    (await repo.write(other.owner.id, noteId, request)).status,
    'invalid_input',
  )
  const plain = createNoteRepository(db)
  assert.equal(
    (await plain.updateNote(f.owner.id, noteId, {content: 'SENTINEL'})).status,
    'unavailable',
  )
  assert.equal(
    (
      await plain.moveNoteToTrash(f.owner.id, noteId, {
        title: 'SENTINEL',
        content: null,
        theme: null,
      })
    ).status,
    'unavailable',
  )
  // Rollback flags stop enrollment/creation, never existing ciphertext saves.
  delete process.env.NOTE_ENCRYPTION_ENROLLMENT_ENABLED
  const save = {
    ...request,
    operation: 'save',
    mutationId: randomUUID(),
    expectedRevision: current.revision,
    payload: {...request.payload, contentId: randomUUID()},
  }
  assert.equal((await repo.write(f.owner.id, noteId, save)).status, 'success')
  assert.equal((await repo.write(f.owner.id, noteId, save)).status, 'success')
  assert.equal(
    (await repo.write(f.owner.id, noteId, {...save, mutationId: randomUUID()}))
      .status,
    'conflict',
  )
  const headers = await repo.headers(f.owner.id, null, false)
  assert.equal(headers.length, 1)
  assert.ok(!JSON.stringify(headers).includes('body'))
  const trashed = await plain.moveNoteToTrash(f.owner.id, noteId)
  assert.equal(trashed.status, 'success')
  if (trashed.status !== 'success') throw Error('trash failed')
  assert.equal(
    (await repo.write(f.owner.id, noteId, save)).status,
    'unavailable',
  )
  assert.equal(
    (await repo.write(f.owner.id, noteId, request)).status,
    'unavailable',
  )
  const trash = await plain.getTrashNotes(f.owner.id)
  assert.equal(trash.length, 1)
  assert.equal(trash[0].encryptedPayload, null)
  assert.ok(!JSON.stringify(trash).includes(request.payload.body.ciphertext))
  assert.equal((await repo.headers(f.owner.id, null, true)).length, 1)
  await plain.permanentlyDeleteTrashedNote(
    f.owner.id,
    noteId,
    trashed.note.deadlineToken,
  )
  process.env.NOTE_ENCRYPTION_CREATION_ENABLED = 'true'
  assert.equal(
    (await repo.write(f.owner.id, noteId, request)).status,
    'unavailable',
  )
  await createAccountRepository(db).deleteAccount(f.owner.id)
  assert.deepEqual(
    await db
      .select()
      .from(noteVaultsTable)
      .where(eq(noteVaultsTable.ownerId, f.owner.id)),
    [],
  )
  assert.deepEqual(
    await db
      .select()
      .from(notesTable)
      .where(eq(notesTable.authorId, f.owner.id)),
    [],
  )
})
test('strict schemas reject plaintext mixed fields and malformed wrappers', async () => {
  const f = await fixture()
  assert.equal(
    (await repo.setup(f.owner.id, {...f.setup, passphrase: 'SENTINEL'})).status,
    'invalid_input',
  )
  assert.equal(
    (
      await repo.setup(f.owner.id, {
        ...f.setup,
        primaryWrapper: {...f.setup.primaryWrapper, salt: bytes(1)},
      })
    ).status,
    'invalid_input',
  )
  const noteId = randomUUID()
  assert.equal(
    (
      await repo.write(f.owner.id, noteId, {
        ...write(f.setup.vaultId, noteId),
        title: 'SENTINEL',
      })
    ).status,
    'invalid_input',
  )
})
test('database independently rejects missing envelopes, mixed plaintext, and swapped identities', async () => {
  const f = await fixture()
  process.env.NOTE_ENCRYPTION_ENROLLMENT_ENABLED = 'true'
  await repo.setup(f.owner.id, f.setup)
  const noteId = randomUUID()
  const request = write(f.setup.vaultId, noteId)
  const base = {
    id: noteId,
    authorId: f.owner.id,
    isEncrypted: true,
    vaultId: f.setup.vaultId,
    encryptedPayload: request.payload,
  }
  for (const patch of [
    {encryptedPayload: {}},
    {encryptedPayload: {version: 1}},
    {title: 'SENTINEL'},
    {encryptedPayload: {...request.payload, noteId: randomUUID()}},
    {encryptedPayload: {...request.payload, title: {}}},
    {encryptedPayload: {...request.payload, contentId: null}},
  ]) {
    await assert.rejects(db.insert(notesTable).values({...base, ...patch}))
  }
  await db.insert(notesTable).values(base)
})
