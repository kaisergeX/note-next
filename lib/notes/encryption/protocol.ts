import {z} from 'zod'

export const ENCRYPTION_VERSION = 1
export const PASSPHRASE_PROFILE = 'pbkdf2-sha256-600000'
export const MAX_NOTE_BYTES = 1048576
export const MAX_RECOVERY_BYTES = 8388608
export const canonicalIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/)
export function encodeBase64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function decodeBase64url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1)
    throw new Error('Invalid encoding')
  const bytes = Uint8Array.from(
    atob(value.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0),
  )
  if (encodeBase64url(bytes) !== value) throw new Error('Noncanonical encoding')
  return bytes
}
const bytes = (min: number, max = min) =>
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
      decodeBase64url(value.title.ciphertext).length +
        decodeBase64url(value.body.ciphertext).length <=
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
