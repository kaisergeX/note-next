// Client-only cryptographic operations. Never persist inputs or returned roots.
import {
  canonicalIdSchema,
  decodeBase64url,
  encodeBase64url,
  encryptedNotePayloadSchema,
  MAX_NOTE_BYTES,
  MAX_RECOVERY_BYTES,
  noteAad,
  recoveryAad,
  sealedEnvelopeSchema,
  utf8,
  vaultWrapperSchema,
  wrapperAad,
  type EncryptedNotePayload,
  type RecoveryIdentity,
  type SealedEnvelope,
  type VaultWrapper,
} from './protocol'

const random = (size: number) => crypto.getRandomValues(new Uint8Array(size))
const aes = {name: 'AES-GCM', length: 256}
const decoder = new TextDecoder('utf-8', {fatal: true})
const buffer = (value: Uint8Array) => new Uint8Array(value)
export const generateRoot = () => random(32)
export async function importRoot(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.length !== 32) throw new Error('Invalid root')
  return crypto.subtle.importKey('raw', buffer(raw), 'HKDF', false, [
    'deriveKey',
  ])
}
async function derived(root: CryptoKey, salt: Uint8Array, info: Uint8Array) {
  return crypto.subtle.deriveKey(
    {name: 'HKDF', hash: 'SHA-256', salt: buffer(salt), info: buffer(info)},
    root,
    aes,
    false,
    ['encrypt', 'decrypt'],
  )
}
async function seal(
  root: CryptoKey,
  aad: Uint8Array,
  payload: Uint8Array,
  limit: number,
): Promise<SealedEnvelope> {
  if (payload.length > limit) throw new Error('Payload too large')
  const salt = random(32),
    iv = random(12)
  const key = await derived(root, salt, aad)
  const ciphertext = await crypto.subtle.encrypt(
    {name: 'AES-GCM', iv, additionalData: buffer(aad), tagLength: 128},
    key,
    buffer(payload),
  )
  return {
    salt: encodeBase64url(salt),
    iv: encodeBase64url(iv),
    ciphertext: encodeBase64url(new Uint8Array(ciphertext)),
  }
}
async function open(
  root: CryptoKey,
  aad: Uint8Array,
  input: SealedEnvelope,
  limit: number,
) {
  const envelope = sealedEnvelopeSchema.parse(input)
  const ciphertext = decodeBase64url(envelope.ciphertext)
  if (ciphertext.length > limit + 16) throw new Error('Payload too large')
  const key = await derived(root, decodeBase64url(envelope.salt), aad)
  return new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: decodeBase64url(envelope.iv),
        additionalData: buffer(aad),
        tagLength: 128,
      },
      key,
      ciphertext,
    ),
  )
}
export async function sealNote(
  root: CryptoKey,
  ownerId: string,
  identity: Pick<EncryptedNotePayload, 'vaultId' | 'noteId' | 'contentId'>,
  content: {title: string | null; content: string | null},
): Promise<EncryptedNotePayload> {
  canonicalIdSchema.parse(ownerId)
  const title = utf8(content.title),
    body = utf8(content.content)
  validateContent(content)
  if (title.length + body.length > MAX_NOTE_BYTES)
    throw new Error('Payload too large')
  return encryptedNotePayloadSchema.parse({
    ...identity,
    version: 1,
    algorithm: 'AES-256-GCM',
    title: await seal(
      root,
      noteAad(ownerId, identity, 'title'),
      title,
      MAX_NOTE_BYTES,
    ),
    body: await seal(
      root,
      noteAad(ownerId, identity, 'body'),
      body,
      MAX_NOTE_BYTES,
    ),
  })
}
function validateContent(value: {title: unknown; content: unknown}) {
  if (
    !(
      value.title === null ||
      (typeof value.title === 'string' && value.title.length <= 765)
    ) ||
    !(
      value.content === null ||
      (typeof value.content === 'string' && value.content.length <= 262144)
    )
  )
    throw new Error('Invalid note content')
}
export async function openNote(
  root: CryptoKey,
  ownerId: string,
  input: EncryptedNotePayload,
  expected: {vaultId: string; noteId: string},
) {
  const payload = encryptedNotePayloadSchema.parse(input)
  if (
    payload.vaultId !== expected.vaultId ||
    payload.noteId !== expected.noteId
  )
    throw new Error('Note identity mismatch')
  const title: unknown = JSON.parse(
    decoder.decode(
      await open(
        root,
        noteAad(ownerId, payload, 'title'),
        payload.title,
        MAX_NOTE_BYTES,
      ),
    ),
  )
  const content: unknown = JSON.parse(
    decoder.decode(
      await open(
        root,
        noteAad(ownerId, payload, 'body'),
        payload.body,
        MAX_NOTE_BYTES,
      ),
    ),
  )
  validateContent({title, content})
  return {title: title as string | null, content: content as string | null}
}
export async function openNoteTitle(
  root: CryptoKey,
  ownerId: string,
  input: Pick<
    EncryptedNotePayload,
    'vaultId' | 'noteId' | 'contentId' | 'title'
  >,
  expected: {vaultId: string; noteId: string},
) {
  if (input.vaultId !== expected.vaultId || input.noteId !== expected.noteId)
    throw new Error('Note identity mismatch')
  canonicalIdSchema.parse(ownerId)
  canonicalIdSchema.parse(input.vaultId)
  canonicalIdSchema.parse(input.noteId)
  canonicalIdSchema.parse(input.contentId)
  const title: unknown = JSON.parse(
    decoder.decode(
      await open(
        root,
        noteAad(ownerId, input, 'title'),
        input.title,
        765 * 6 + 2,
      ),
    ),
  )
  validateContent({title, content: null})
  return title as string | null
}
export const sealRecovery = (
  root: CryptoKey,
  context: RecoveryIdentity,
  payload: unknown,
) => seal(root, recoveryAad(context), utf8(payload), MAX_RECOVERY_BYTES)
export async function openRecovery(
  root: CryptoKey,
  context: RecoveryIdentity,
  envelope: SealedEnvelope,
): Promise<unknown> {
  return JSON.parse(
    decoder.decode(
      await open(root, recoveryAad(context), envelope, MAX_RECOVERY_BYTES),
    ),
  )
}
async function wrappingKey(wrapper: VaultWrapper, secret: string | Uint8Array) {
  if (wrapper.purpose === 'passphrase') {
    if (typeof secret !== 'string') throw new Error('Passphrase required')
    const material = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      'PBKDF2',
      false,
      ['deriveKey'],
    )
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: 600000,
        salt: decodeBase64url(wrapper.salt!),
      },
      material,
      aes,
      false,
      ['encrypt', 'decrypt'],
    )
  }
  if (typeof secret === 'string' || secret.length !== 32)
    throw new Error('Invalid secret')
  if (wrapper.purpose === 'recovery')
    return crypto.subtle.importKey('raw', buffer(secret), aes, false, [
      'encrypt',
      'decrypt',
    ])
  const material = await importRoot(secret)
  return derived(
    material,
    decodeBase64url(wrapper.passkeyBinding![2]),
    utf8(['eton', 1, 'passkey-wrap-key', wrapper.passkeyBinding]),
  )
}
export type WrapperContext = Omit<
  VaultWrapper,
  'version' | 'algorithm' | 'iv' | 'ciphertext'
>
export async function wrapRoot(
  raw: Uint8Array,
  context: WrapperContext,
  secret: string | Uint8Array,
): Promise<VaultWrapper> {
  if (raw.length !== 32) throw new Error('Invalid root')
  const wrapper = vaultWrapperSchema.parse({
    ...context,
    version: 1,
    algorithm: 'AES-256-GCM',
    iv: encodeBase64url(random(12)),
    ciphertext: encodeBase64url(new Uint8Array(48)),
  })
  const key = await wrappingKey(wrapper, secret)
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: decodeBase64url(wrapper.iv),
      additionalData: wrapperAad(wrapper),
      tagLength: 128,
    },
    key,
    buffer(raw),
  )
  return {...wrapper, ciphertext: encodeBase64url(new Uint8Array(ciphertext))}
}
export async function unwrapRoot(
  input: VaultWrapper,
  secret: string | Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const wrapper = vaultWrapperSchema.parse(input)
  const key = await wrappingKey(wrapper, secret)
  return new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: decodeBase64url(wrapper.iv),
        additionalData: wrapperAad(wrapper),
        tagLength: 128,
      },
      key,
      decodeBase64url(wrapper.ciphertext),
    ),
  )
}
export const generatePassphraseSalt = () => encodeBase64url(random(16))
// Sixteen independent selections from 64 words provide 96 bits of entropy.
// The 64-word size divides 256 exactly, so masking adds no modulo bias.
export function generatePassphrase() {
  const words =
    'amber apple arch arrow atlas autumn bamboo beach berry birch bloom blue boat brave breeze brook cedar cherry cloud coral crane creek dawn deer delta dune eagle earth elm fern field flame forest frost garden glass globe grape green grove harbor hazel hill honey iris island jade lake leaf lemon light lilac linen maple meadow mint moon moss oak ocean olive orchid pearl pine'.split(
      ' ',
    )
  return Array.from(random(16), (byte) => words[byte & 63]).join(' ')
}
export async function encodeRecoveryKey(secret: Uint8Array): Promise<string> {
  if (secret.length !== 32) throw new Error('Invalid recovery key')
  const checksum = new Uint8Array(
    await crypto.subtle.digest('SHA-256', buffer(secret)),
  ).slice(0, 4)
  return `eton-recovery-1.${encodeBase64url(secret)}.${encodeBase64url(checksum)}`
}
export async function decodeRecoveryKey(value: string) {
  const parts = value.split('.')
  if (parts.length !== 3 || parts[0] !== 'eton-recovery-1')
    throw new Error('Invalid recovery key')
  const secret = decodeBase64url(parts[1])
  if ((await encodeRecoveryKey(secret)) !== value)
    throw new Error('Invalid recovery checksum')
  return secret
}
function canonicalWrapper(w: VaultWrapper) {
  vaultWrapperSchema.parse(w)
  return utf8([
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
  ])
}
export async function setupRootCommitment(
  root: Uint8Array,
  context: {
    ownerId: string
    vaultId: string
    setupId: string
    primary: VaultWrapper
    recovery: VaultWrapper
  },
) {
  if (root.length !== 32) throw new Error('Invalid root')
  const hash = async (w: VaultWrapper) =>
    encodeBase64url(
      new Uint8Array(
        await crypto.subtle.digest('SHA-256', canonicalWrapper(w)),
      ),
    )
  const aad = utf8([
    'eton',
    1,
    'setup-root-check',
    context.ownerId,
    context.vaultId,
    context.setupId,
    await hash(context.primary),
    await hash(context.recovery),
  ])
  const input = new Uint8Array(aad.length + 32)
  input.set(aad)
  input.set(root, aad.length)
  return encodeBase64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', input)),
  )
}
