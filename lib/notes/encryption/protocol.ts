import {z} from 'zod'

export const ENCRYPTION_VERSION = 1
export const PASSPHRASE_PROFILE = 'pbkdf2-sha256-600000'
export const MAX_NOTE_BYTES = 1048576
export const MAX_RECOVERY_BYTES = 8388608
export const canonicalIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/)
const base64urlAlphabet =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const base64urlCodes = new TextEncoder().encode(base64urlAlphabet)
export function encodeBase64url(bytes: Uint8Array): string {
  if (typeof bytes.toBase64 === 'function')
    return bytes.toBase64({alphabet: 'base64url', omitPadding: true})
  // Encode directly to ASCII. Building a binary string byte by byte stalls
  // the editor for hundreds of milliseconds on large recovery checkpoints.
  const encoded = new Uint8Array(Math.ceil((bytes.length * 4) / 3))
  let input = 0
  let output = 0
  for (; input + 2 < bytes.length; input += 3) {
    const group =
      (bytes[input] << 16) | (bytes[input + 1] << 8) | bytes[input + 2]
    encoded[output++] = base64urlCodes[group >>> 18]
    encoded[output++] = base64urlCodes[(group >>> 12) & 63]
    encoded[output++] = base64urlCodes[(group >>> 6) & 63]
    encoded[output++] = base64urlCodes[group & 63]
  }
  if (input < bytes.length) {
    const first = bytes[input]
    const second = bytes[input + 1] ?? 0
    encoded[output++] = base64urlCodes[first >>> 2]
    encoded[output++] = base64urlCodes[((first & 3) << 4) | (second >>> 4)]
    if (input + 1 < bytes.length)
      encoded[output] = base64urlCodes[(second & 15) << 2]
  }
  return new TextDecoder().decode(encoded)
}
function isCanonicalBase64url(value: string) {
  const remainder = value.length % 4
  if (remainder === 1 || /[^A-Za-z0-9_-]/.test(value)) return false
  if (remainder === 0) return true
  // A final sextet for one or two trailing bytes has four or two unused
  // low bits respectively. A canonical unpadded encoding sets these to zero.
  const lastSextet = base64urlAlphabet.indexOf(value[value.length - 1])
  return (lastSextet & (remainder === 2 ? 15 : 3)) === 0
}
const decodedLength = (value: string) => Math.floor((value.length * 3) / 4)
export function decodeBase64url(value: string): Uint8Array<ArrayBuffer> {
  if (!isCanonicalBase64url(value)) throw new Error('Invalid encoding')
  if (typeof Uint8Array.fromBase64 === 'function')
    return Uint8Array.fromBase64(value, {alphabet: 'base64url'})
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
const bytes = (min: number, max = min) =>
  z
    .string()
    .min(Math.ceil((min * 4) / 3))
    .max(Math.ceil((max * 4) / 3))
    .refine(isCanonicalBase64url)
export const sealedEnvelopeSchema = z.strictObject({
  salt: bytes(32),
  iv: bytes(12),
  ciphertext: bytes(16, MAX_RECOVERY_BYTES + 16),
})
export type SealedEnvelope = z.infer<typeof sealedEnvelopeSchema>
export const encryptedNotePayloadSchema = z
  .strictObject({
    version: z.literal(1),
    algorithm: z.literal('AES-256-GCM'),
    vaultId: canonicalIdSchema,
    noteId: canonicalIdSchema,
    contentId: canonicalIdSchema,
    title: sealedEnvelopeSchema,
    body: sealedEnvelopeSchema,
  })
  .refine(
    (value) =>
      decodedLength(value.title.ciphertext) +
        decodedLength(value.body.ciphertext) <=
      MAX_NOTE_BYTES + 32,
  )
export type EncryptedNotePayload = z.infer<typeof encryptedNotePayloadSchema>
export const vaultWrapperSchema = z
  .strictObject({
    version: z.literal(1),
    algorithm: z.literal('AES-256-GCM'),
    ownerId: canonicalIdSchema,
    vaultId: canonicalIdSchema,
    wrapperId: canonicalIdSchema,
    purpose: z.enum(['passphrase', 'passkey', 'recovery']),
    profileId: z
      .enum([PASSPHRASE_PROFILE, 'webauthn-prf-hkdf-sha256'])
      .nullable(),
    passkeyBinding: z
      .tuple([z.string().min(1).max(253), bytes(1, 1024), bytes(32)])
      .nullable(),
    salt: bytes(16).nullable(),
    iv: bytes(12),
    ciphertext: bytes(48),
  })
  .superRefine((w, ctx) => {
    const valid =
      w.purpose === 'passphrase'
        ? w.profileId === PASSPHRASE_PROFILE &&
          w.salt !== null &&
          w.passkeyBinding === null
        : w.purpose === 'passkey'
          ? w.profileId === 'webauthn-prf-hkdf-sha256' &&
            w.passkeyBinding !== null &&
            w.salt === null
          : w.profileId === null && w.passkeyBinding === null && w.salt === null
    if (!valid)
      ctx.addIssue({code: 'custom', message: 'Invalid wrapper profile'})
  })
export type VaultWrapper = z.infer<typeof vaultWrapperSchema>
export const utf8 = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value))
export const noteAad = (
  ownerId: string,
  payload: Pick<EncryptedNotePayload, 'vaultId' | 'noteId' | 'contentId'>,
  field: 'title' | 'body',
) =>
  utf8([
    'eton',
    1,
    'note',
    ownerId,
    payload.vaultId,
    payload.noteId,
    payload.contentId,
    field,
  ])
export const wrapperAad = (w: VaultWrapper) =>
  utf8([
    'eton',
    1,
    'vault-wrap',
    w.ownerId,
    w.vaultId,
    w.purpose,
    w.wrapperId,
    w.profileId,
    w.passkeyBinding,
  ])
export type RecoveryIdentity = {
  ownerId: string
  vaultId: string
  stableNoteId: string
  recordId: string
  generation: number
  capturedEpoch: number
}
export const recoveryAad = (r: RecoveryIdentity) =>
  utf8([
    'eton',
    1,
    'recovery',
    r.ownerId,
    r.vaultId,
    r.stableNoteId,
    r.recordId,
    r.generation,
    r.capturedEpoch,
  ])
