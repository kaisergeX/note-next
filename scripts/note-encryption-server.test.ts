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
  return {owner, setup: {vaultId, setupId, primaryWrapper, recoveryWrapper}}
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
  assert.equal('replacePrimary' in repo, false)
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
    const setup = {...f.setup, primaryWrapper, recoveryWrapper}
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
    assert.equal('replacePrimary' in repo, false)
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
