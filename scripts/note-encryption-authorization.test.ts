import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createCipheriv, generateKeyPairSync, hkdfSync} from 'node:crypto'
import {
  authorizationSchema,
  createAuthorization,
  openAuthorizationSigner,
  replacementIntentBytes,
  replacementIntentDigest,
  replacementIntentSchema,
  signReplacement,
  validateAuthorization,
  verifyReplacement,
  type ReplacementIntent,
} from '../lib/notes/encryption/authorization'
import {
  decodeBase64url,
  encodeBase64url,
} from '../lib/notes/encryption/protocol'
import {generateRoot, setupRootCommitment} from '../lib/notes/encryption/crypto'

const id = (n: number) =>
  `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const owner = id(1),
  vault = id(2),
  setup = id(3)
const fixtures = JSON.parse(
  await readFile(
    new URL('./fixtures/note-encryption-signed-intents.json', import.meta.url),
    'utf8',
  ),
)
function cleanIntent(verifierId: string): ReplacementIntent {
  return {
    ownerId: owner,
    vaultId: vault,
    verifierId,
    expectedRevision: id(4),
    operationId: id(5),
    primaryWrapper: {
      ...fixtures.vectors[0].input.wrapper,
      ownerId: owner,
      vaultId: vault,
    },
  }
}
test('root-protected independent signer authorizes exact intent and rejects substitutions', async () => {
  const root = generateRoot()
  const auth = await createAuthorization(root, owner, vault, setup)
  assert.deepEqual(await validateAuthorization(auth), auth)
  const signer = await openAuthorizationSigner(root, owner, vault, setup, auth)
  assert.equal(signer.extractable, false)
  await assert.rejects(crypto.subtle.exportKey('pkcs8', signer))
  const v = cleanIntent(auth.verifierId)
  assert.equal(
    replacementIntentSchema.safeParse({...v, extra: true}).success,
    false,
  )
  const request = await signReplacement(signer, v)
  assert.equal(await verifyReplacement(auth, request), true)
  const again = await signReplacement(signer, v)
  assert.equal(await verifyReplacement(auth, again), true)
  const {signature: firstSignature, ...firstIntent} = request
  const {signature: secondSignature, ...secondIntent} = again
  assert.equal(firstSignature.length, secondSignature.length)
  assert.equal(
    await replacementIntentDigest(firstIntent),
    await replacementIntentDigest(secondIntent),
  )
  const signatureBytes = decodeBase64url(firstSignature)
  const order = BigInt(
    '0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551',
  )
  const s = BigInt('0x' + Buffer.from(signatureBytes.slice(32)).toString('hex'))
  signatureBytes.set(
    Buffer.from((order - s).toString(16).padStart(64, '0'), 'hex'),
    32,
  )
  const alternate = {...request, signature: encodeBase64url(signatureBytes)}
  assert.notEqual(alternate.signature, request.signature)
  assert.equal(await verifyReplacement(auth, alternate), true)
  assert.equal(
    await replacementIntentDigest(v),
    await replacementIntentDigest({...v}),
  )
  for (const changed of [
    {...request, operationId: id(6)},
    {...request, expectedRevision: id(6)},
    {...request, ownerId: id(6)},
    {...request, vaultId: id(6)},
    {...request, verifierId: encodeBase64url(generateRoot())},
    {...request, primaryWrapper: {...request.primaryWrapper, wrapperId: id(6)}},
    {...request, signature: encodeBase64url(new Uint8Array(64))},
  ])
    assert.equal(await verifyReplacement(auth, changed), false)
  for (const args of [
    [generateRoot(), owner, vault, setup],
    [root, id(6), vault, setup],
    [root, owner, id(6), setup],
    [root, owner, vault, id(6)],
  ] as const)
    await assert.rejects(openAuthorizationSigner(...args, auth))
  const other = await createAuthorization(root, owner, vault, setup)
  for (const changed of [
    {...auth, signerId: id(6)},
    {...auth, signerEnvelope: other.signerEnvelope},
    {...auth, publicKey: other.publicKey, verifierId: other.verifierId},
  ])
    await assert.rejects(
      openAuthorizationSigner(root, owner, vault, setup, changed),
    )
  await assert.rejects(
    validateAuthorization({...auth, verifierId: other.verifierId}),
  )
  assert.equal(
    authorizationSchema.safeParse({...auth, extra: true}).success,
    false,
  )
  root.fill(0)
})
test('strict encodings, unsupported suite, malformed points and encrypted wrong private key fail closed', async () => {
  const root = generateRoot()
  const auth = await createAuthorization(root, owner, vault, setup)
  const signer = await openAuthorizationSigner(root, owner, vault, setup, auth)
  const request = await signReplacement(signer, cleanIntent(auth.verifierId))
  assert.equal(
    await verifyReplacement(auth, {
      ...request,
      signature: request.signature + '=',
    }),
    false,
  )
  for (const changed of [
    {...auth, publicKey: auth.publicKey + '='},
    {...auth, verifierId: auth.verifierId + '='},
    {...auth, algorithm: 'ECDSA-P384-SHA384'},
    {...auth, signerEnvelope: {...auth.signerEnvelope, extra: true}},
    {
      ...auth,
      signerEnvelope: {
        ...auth.signerEnvelope,
        ciphertext: encodeBase64url(new Uint8Array(529)),
      },
    },
  ])
    await assert.rejects(validateAuthorization(changed))
  const malformed = new Uint8Array(65)
  malformed[0] = 4
  await assert.rejects(
    validateAuthorization({
      ...auth,
      publicKey: encodeBase64url(malformed),
      verifierId: encodeBase64url(
        new Uint8Array(await crypto.subtle.digest('SHA-256', malformed)),
      ),
    }),
  )
  const corrupted = decodeBase64url(auth.signerEnvelope.ciphertext)
  corrupted[0] ^= 1
  await assert.rejects(
    openAuthorizationSigner(root, owner, vault, setup, {
      ...auth,
      signerEnvelope: {
        ...auth.signerEnvelope,
        ciphertext: encodeBase64url(corrupted),
      },
    }),
  )
  // Independent OpenSSL envelope construction reaches the private/public
  // correspondence check with authentic AAD and a valid but different key.
  const wrongPrivate = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  }).privateKey.export({format: 'der', type: 'pkcs8'})
  const aad = Buffer.from(
    JSON.stringify([
      'eton',
      1,
      'vault-authorization-signer',
      owner,
      vault,
      setup,
      auth.algorithm,
      auth.verifierId,
      auth.signerId,
    ]),
  )
  const key = hkdfSync(
    'sha256',
    root,
    decodeBase64url(auth.signerEnvelope.salt),
    aad,
    32,
  )
  const cipher = createCipheriv(
    'aes-256-gcm',
    Buffer.from(key),
    decodeBase64url(auth.signerEnvelope.iv),
  )
  cipher.setAAD(aad)
  const encrypted = Buffer.concat([
    cipher.update(wrongPrivate),
    cipher.final(),
    cipher.getAuthTag(),
  ])
  await assert.rejects(
    openAuthorizationSigner(root, owner, vault, setup, {
      ...auth,
      signerEnvelope: {
        ...auth.signerEnvelope,
        ciphertext: encodeBase64url(encrypted),
      },
    }),
    /Signer mismatch/,
  )
  wrongPrivate.fill(0)
  root.fill(0)
})
test('fixed independently signed vectors retain exact canonical bytes and digests', async () => {
  for (const vector of fixtures.vectors) {
    const {
      ownerId,
      vaultId,
      verifierId,
      expectedRevision,
      operationId,
      wrapper,
    } = vector.input
    const v = {
      ownerId,
      vaultId,
      verifierId,
      expectedRevision,
      operationId,
      primaryWrapper: wrapper,
    }
    assert.equal(
      new TextDecoder().decode(replacementIntentBytes(v)),
      vector.messageUtf8,
    )
    assert.equal(
      Buffer.from(decodeBase64url(await replacementIntentDigest(v))).toString(
        'hex',
      ),
      vector.messageSha256,
    )
    const auth = {
      ...(await createAuthorization(generateRoot(), owner, vault, setup)),
      publicKey: fixtures.publicKeyRaw,
      verifierId: fixtures.publicKeySha256,
    }
    assert.equal(
      await verifyReplacement(auth, {...v, signature: vector.signatureP1363}),
      true,
    )
    assert.equal(
      await verifyReplacement(auth, {
        ...v,
        signature: vector.signatureP1363,
        extra: true,
      } as typeof v & {signature: string}),
      false,
    )
  }
})
test('setup commitment binds authorization while absent legacy authorization is stable', async () => {
  const root = generateRoot(),
    auth = await createAuthorization(root, owner, vault, setup)
  const primary = cleanIntent(auth.verifierId).primaryWrapper
  const context = {
    ownerId: owner,
    vaultId: vault,
    setupId: setup,
    primary,
    recovery: primary,
  }
  const legacy = await setupRootCommitment(root, context)
  assert.equal(
    legacy,
    await setupRootCommitment(root, {...context, authorization: undefined}),
  )
  const bound = await setupRootCommitment(root, {
    ...context,
    authorization: auth,
  })
  assert.notEqual(bound, legacy)
  assert.notEqual(
    bound,
    await setupRootCommitment(root, {
      ...context,
      authorization: {...auth, signerId: id(6)},
    }),
  )
})
