import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createDecipheriv, hkdfSync} from 'node:crypto'
import {
  createVaultCandidate,
  verifyCandidate,
} from '../lib/notes/encryption/candidate'
import {
  decodeRecoveryKey,
  encodeRecoveryKey,
  generatePassphraseSalt,
  generateRoot,
  importRoot,
  openNote,
  openNoteTitle,
  generatePassphrase,
  openRecovery,
  sealNote,
  sealRecovery,
  setupRootCommitment,
  unwrapRoot,
  wrapRoot,
} from '../lib/notes/encryption/crypto'
import {
  decodeBase64url,
  encryptedNotePayloadSchema,
  noteAad,
  PASSPHRASE_PROFILE,
} from '../lib/notes/encryption/protocol'

const ownerId = '00000000-0000-0000-0000-000000000001'
const vaultId = '00000000-0000-0000-0000-000000000002'
const noteId = '00000000-0000-0000-0000-000000000003'
const contentId = '00000000-0000-0000-0000-000000000004'
test('frozen v1 OpenSSL title fixture and generated phrase entropy shape', async () => {
  const root = await importRoot(new Uint8Array(32).fill(1))
  const title = {
    salt: Buffer.alloc(32, 2).toString('base64url'),
    iv: Buffer.alloc(12, 3).toString('base64url'),
    ciphertext: 'Nzf-Y3n96sL_93qzxkJFOsZkxtJT41Y-v9bay_0FhH-OLcT_vPjklw',
  }
  assert.equal(
    await openNoteTitle(
      root,
      ownerId,
      {vaultId, noteId, contentId, title},
      {vaultId, noteId},
    ),
    'Tiếng Việt 🗝️',
  )
  assert.equal(generatePassphrase().split(' ').length, 16)
})
test('provisional setup survives sealed-only sequential verification and rejects changed tuples', async () => {
  const {candidate, passphrase, recoveryKit} =
    await createVaultCandidate(ownerId)
  const serialized = JSON.stringify(candidate)
  assert.equal(serialized.includes(passphrase), false)
  assert.equal(serialized.includes(recoveryKit), false)
  const first = await verifyCandidate(
    JSON.parse(serialized),
    'primary',
    passphrase,
  )
  assert.equal(first.primaryChecked, true)
  assert.equal(first.recoveryChecked, false)
  const second = await verifyCandidate(
    JSON.parse(JSON.stringify(first)),
    'recovery',
    recoveryKit,
  )
  assert.equal(second.primaryChecked && second.recoveryChecked, true)
  await assert.rejects(
    verifyCandidate({...candidate, setupId: noteId}, 'primary', passphrase),
  )
})
test('Unicode note seals with fresh contexts and interoperates with Node OpenSSL', async () => {
  const raw = generateRoot(),
    root = await importRoot(raw)
  const content = {title: 'Tiếng Việt 🗝️', content: '<p>e\u0301 ≠ é 中文</p>'}
  const a = await sealNote(root, ownerId, {vaultId, noteId, contentId}, content)
  const b = await sealNote(root, ownerId, {vaultId, noteId, contentId}, content)
  assert.notEqual(a.title.iv, b.title.iv)
  assert.notEqual(a.title.salt, b.title.salt)
  assert.deepEqual(await openNote(root, ownerId, a, {vaultId, noteId}), content)
  const key = hkdfSync(
    'sha256',
    raw,
    decodeBase64url(a.title.salt),
    noteAad(ownerId, a, 'title'),
    32,
  )
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    decodeBase64url(a.title.iv),
  )
  const bytes = decodeBase64url(a.title.ciphertext)
  decipher.setAAD(noteAad(ownerId, a, 'title'))
  decipher.setAuthTag(bytes.slice(-16))
  assert.equal(
    Buffer.concat([
      decipher.update(bytes.slice(0, -16)),
      decipher.final(),
    ]).toString(),
    JSON.stringify(content.title),
  )
  for (const input of [
    {...a, title: a.body},
    {...a, contentId: noteId},
    {...a, title: {...a.title, iv: b.title.iv}},
  ])
    await assert.rejects(openNote(root, ownerId, input, {vaultId, noteId}))
  await assert.rejects(openNote(root, noteId, a, {vaultId, noteId}))
  assert.equal(
    encryptedNotePayloadSchema.safeParse({...a, version: 2}).success,
    false,
  )
  assert.equal(root.extractable, false)
})
test('independent passphrase and recovery wrappers, exact Unicode and commitment', async () => {
  const raw = generateRoot(),
    secret = generateRoot()
  const base = {ownerId, vaultId, wrapperId: noteId, passkeyBinding: null}
  const primary = await wrapRoot(
    raw,
    {
      ...base,
      purpose: 'passphrase',
      profileId: PASSPHRASE_PROFILE,
      salt: generatePassphraseSalt(),
    },
    ' e\u0301 Password ',
  )
  const recovery = await wrapRoot(
    raw,
    {
      ...base,
      wrapperId: contentId,
      purpose: 'recovery',
      profileId: null,
      salt: null,
    },
    secret,
  )
  assert.deepEqual(await unwrapRoot(primary, ' e\u0301 Password '), raw)
  await assert.rejects(unwrapRoot(primary, ' é Password '))
  await assert.rejects(unwrapRoot(primary, 'wrong'))
  assert.deepEqual(
    await unwrapRoot(
      recovery,
      await decodeRecoveryKey(await encodeRecoveryKey(secret)),
    ),
    raw,
  )
  await assert.rejects(
    decodeRecoveryKey((await encodeRecoveryKey(secret)).slice(0, -1) + '!'),
  )
  const context = {ownerId, vaultId, setupId: contentId, primary, recovery}
  assert.equal(
    await setupRootCommitment(raw, context),
    await setupRootCommitment(await unwrapRoot(recovery, secret), context),
  )
  assert.notEqual(
    await setupRootCommitment(raw, context),
    await setupRootCommitment(raw, {...context, setupId: noteId}),
  )
})
test('recovery routing substitution and passkey credential binding fail closed', async () => {
  const raw = generateRoot(),
    root = await importRoot(raw)
  const context = {
    ownerId,
    vaultId,
    stableNoteId: noteId,
    recordId: contentId,
    generation: 1,
    capturedEpoch: 1,
  }
  const envelope = await sealRecovery(root, context, {
    routing: context,
    draft: 'private',
  })
  assert.deepEqual(await openRecovery(root, context, envelope), {
    routing: context,
    draft: 'private',
  })
  await assert.rejects(
    openRecovery(root, {...context, stableNoteId: contentId}, envelope),
  )
  const secret = generateRoot()
  const wrapper = await wrapRoot(
    raw,
    {
      ownerId,
      vaultId,
      wrapperId: noteId,
      purpose: 'passkey',
      profileId: 'webauthn-prf-hkdf-sha256',
      salt: null,
      passkeyBinding: [
        'example.com',
        'AQ',
        Buffer.from(generateRoot()).toString('base64url'),
      ],
    },
    secret,
  )
  assert.deepEqual(await unwrapRoot(wrapper, secret), raw)
  await assert.rejects(
    unwrapRoot(
      {
        ...wrapper,
        passkeyBinding: ['example.com', 'Ag', wrapper.passkeyBinding![2]],
      },
      secret,
    ),
  )
})
