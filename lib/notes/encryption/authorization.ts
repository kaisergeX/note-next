import {z} from 'zod'
import {
  canonicalIdSchema,
  decodeBase64url,
  encodeBase64url,
  utf8,
  vaultWrapperSchema,
} from './protocol'

const encodedBytes = (min: number, max = min) =>
  z
    .string()
    .max(Math.ceil((max * 4) / 3))
    .refine((value) => {
      try {
        const length = decodeBase64url(value).length
        return length >= min && length <= max
      } catch {
        return false
      }
    })
export const authorizationSchema = z.strictObject({
  version: z.literal(1),
  algorithm: z.literal('ECDSA-P256-SHA256'),
  verifierId: encodedBytes(32),
  publicKey: encodedBytes(65),
  signerId: canonicalIdSchema,
  signerEnvelope: z.strictObject({
    salt: encodedBytes(32),
    iv: encodedBytes(12),
    ciphertext: encodedBytes(17, 528),
  }),
})
export type VaultAuthorization = z.infer<typeof authorizationSchema>
const intentFields = {
  ownerId: canonicalIdSchema,
  vaultId: canonicalIdSchema,
  verifierId: encodedBytes(32),
  expectedRevision: canonicalIdSchema,
  operationId: canonicalIdSchema,
  primaryWrapper: vaultWrapperSchema,
}
const validIntent = (v: z.infer<typeof rawIntentSchema>) =>
  v.primaryWrapper.purpose !== 'recovery' &&
  v.primaryWrapper.ownerId === v.ownerId &&
  v.primaryWrapper.vaultId === v.vaultId
const rawIntentSchema = z.strictObject(intentFields)
export const replacementIntentSchema = rawIntentSchema.refine(validIntent)
export const signedReplacementSchema = z
  .strictObject({...intentFields, signature: encodedBytes(64)})
  .refine(validIntent)
export type ReplacementIntent = z.infer<typeof replacementIntentSchema>
export type SignedReplacement = z.infer<typeof signedReplacementSchema>
const ec = {name: 'ECDSA', namedCurve: 'P-256'}
const signatureAlgorithm = {name: 'ECDSA', hash: 'SHA-256'}
const random = (size: number) => crypto.getRandomValues(new Uint8Array(size))
const hash = async (bytes: Uint8Array) =>
  encodeBase64url(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)),
    ),
  )

export function replacementIntentBytes(input: ReplacementIntent) {
  const v = replacementIntentSchema.parse(input)
  const w = v.primaryWrapper
  return utf8([
    'eton',
    1,
    'authorize-primary-replacement',
    v.ownerId,
    v.vaultId,
    v.verifierId,
    v.expectedRevision,
    v.operationId,
    [
      w.version,
      w.algorithm,
      w.ownerId,
      w.vaultId,
      w.wrapperId,
      w.purpose,
      w.profileId,
      w.passkeyBinding,
      w.salt,
      w.iv,
      w.ciphertext,
    ],
  ])
}
export const replacementIntentDigest = (intent: ReplacementIntent) =>
  hash(replacementIntentBytes(intent))

export async function validateAuthorization(input: unknown) {
  const auth = authorizationSchema.parse(input)
  const raw = decodeBase64url(auth.publicKey)
  if (raw[0] !== 4 || (await hash(raw)) !== auth.verifierId)
    throw new Error('Invalid authorization verifier')
  await crypto.subtle.importKey('raw', raw, ec, false, ['verify'])
  return auth
}
function signerAad(
  ownerId: string,
  vaultId: string,
  setupId: string,
  auth: VaultAuthorization,
) {
  canonicalIdSchema.parse(ownerId)
  canonicalIdSchema.parse(vaultId)
  canonicalIdSchema.parse(setupId)
  return utf8([
    'eton',
    1,
    'vault-authorization-signer',
    ownerId,
    vaultId,
    setupId,
    auth.algorithm,
    auth.verifierId,
    auth.signerId,
  ])
}
async function signerKey(
  rawRoot: Uint8Array,
  salt: Uint8Array,
  aad: Uint8Array,
) {
  if (rawRoot.length !== 32) throw new Error('Invalid root')
  const root = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(rawRoot),
    'HKDF',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(salt),
      info: new Uint8Array(aad),
    },
    root,
    {name: 'AES-GCM', length: 256},
    false,
    ['encrypt', 'decrypt'],
  )
}
export async function createAuthorization(
  rawRoot: Uint8Array,
  ownerId: string,
  vaultId: string,
  setupId: string,
): Promise<VaultAuthorization> {
  const pair = await crypto.subtle.generateKey(ec, true, ['sign', 'verify'])
  const publicKey = new Uint8Array(
    await crypto.subtle.exportKey('raw', pair.publicKey),
  )
  const privateKey = new Uint8Array(
    await crypto.subtle.exportKey('pkcs8', pair.privateKey),
  )
  try {
    if (privateKey.length > 512) throw new Error('Signer too large')
    const salt = random(32),
      iv = random(12)
    const auth: VaultAuthorization = {
      version: 1,
      algorithm: 'ECDSA-P256-SHA256',
      verifierId: await hash(publicKey),
      publicKey: encodeBase64url(publicKey),
      signerId: crypto.randomUUID(),
      signerEnvelope: {
        salt: encodeBase64url(salt),
        iv: encodeBase64url(iv),
        ciphertext: '',
      },
    }
    const aad = signerAad(ownerId, vaultId, setupId, auth)
    const key = await signerKey(rawRoot, salt, aad)
    auth.signerEnvelope.ciphertext = encodeBase64url(
      new Uint8Array(
        await crypto.subtle.encrypt(
          {name: 'AES-GCM', iv, additionalData: aad, tagLength: 128},
          key,
          privateKey,
        ),
      ),
    )
    return authorizationSchema.parse(auth)
  } finally {
    privateKey.fill(0)
  }
}
export async function openAuthorizationSigner(
  rawRoot: Uint8Array,
  ownerId: string,
  vaultId: string,
  setupId: string,
  input: VaultAuthorization,
) {
  const auth = await validateAuthorization(input)
  const aad = signerAad(ownerId, vaultId, setupId, auth)
  const key = await signerKey(
    rawRoot,
    decodeBase64url(auth.signerEnvelope.salt),
    aad,
  )
  const raw = new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: decodeBase64url(auth.signerEnvelope.iv),
        additionalData: aad,
        tagLength: 128,
      },
      key,
      decodeBase64url(auth.signerEnvelope.ciphertext),
    ),
  )
  try {
    const signer = await crypto.subtle.importKey('pkcs8', raw, ec, false, [
      'sign',
    ])
    const verifier = await crypto.subtle.importKey(
      'raw',
      decodeBase64url(auth.publicKey),
      ec,
      false,
      ['verify'],
    )
    const challenge = random(32)
    const proof = await crypto.subtle.sign(
      signatureAlgorithm,
      signer,
      challenge,
    )
    if (
      !(await crypto.subtle.verify(
        signatureAlgorithm,
        verifier,
        proof,
        challenge,
      ))
    )
      throw new Error('Signer mismatch')
    return signer
  } finally {
    raw.fill(0)
  }
}
export async function signReplacement(
  signer: CryptoKey,
  input: ReplacementIntent,
): Promise<SignedReplacement> {
  const intent = replacementIntentSchema.parse(input)
  const signature = await crypto.subtle.sign(
    signatureAlgorithm,
    signer,
    replacementIntentBytes(intent),
  )
  return signedReplacementSchema.parse({
    ...intent,
    signature: encodeBase64url(new Uint8Array(signature)),
  })
}
export async function verifyReplacement(
  input: VaultAuthorization,
  request: SignedReplacement,
) {
  try {
    const auth = await validateAuthorization(input)
    const {signature, ...intent} = signedReplacementSchema.parse(request)
    if (intent.verifierId !== auth.verifierId) return false
    const verifier = await crypto.subtle.importKey(
      'raw',
      decodeBase64url(auth.publicKey),
      ec,
      false,
      ['verify'],
    )
    return crypto.subtle.verify(
      signatureAlgorithm,
      verifier,
      decodeBase64url(signature),
      replacementIntentBytes(intent),
    )
  } catch {
    return false
  }
}
