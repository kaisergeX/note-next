import {Dexie, type EntityTable} from 'dexie'
import type {ConfirmedVault} from './runtime'
import {z} from 'zod'
import {
  authorizationSchema,
  signedReplacementSchema,
  type SignedReplacement,
} from './authorization'
import {openRecovery, sealRecoveryBytes} from './crypto'
import {
  canonicalIdSchema,
  vaultWrapperSchema,
  type SealedEnvelope,
} from './protocol'
import {
  RECOVERY_STORED_LIMIT,
  recoveryRouteSchema,
  validateRecoveryPayload,
  prepareRecoveryPayload,
  type RecoveryPayload,
  type RecoveryRoute,
} from './recovery'

export type RecoveryHeader = RecoveryRoute & {
  id: string
  updatedAt: number
  status:
    'local' | 'synced' | 'flight' | 'conflict' | 'retained' | 'quarantined'
  versionId: string
  encodedBytes: number
}
type SealedRecord = {id: string; ownerId: string; envelope: SealedEnvelope}
export function recoveryRouteFromHeader(header: RecoveryHeader): RecoveryRoute {
  return recoveryRouteSchema.parse(
    Object.fromEntries(
      Object.keys(recoveryRouteSchema.shape).map((key) => [
        key,
        header[key as keyof RecoveryRoute],
      ]),
    ),
  )
}
type ModeMarker = {
  id: string
  ownerId: string
  stableNoteId: string
  epoch: number
  mode: 'encrypted'
}
const db = new Dexie('etoN-encrypted-note-recovery') as Dexie & {
  intents: EntityTable<{ownerId: string; request: SignedReplacement}, 'ownerId'>
  headers: EntityTable<RecoveryHeader, 'id'>
  payloads: EntityTable<SealedRecord, 'id'>
  modes: EntityTable<ModeMarker, 'id'>
  vaults: EntityTable<
    {ownerId: string; vaultId: string; revision: string; publicVault: unknown},
    'ownerId'
  >
}
db.version(1).stores({
  headers:
    'id, ownerId, [ownerId+stableNoteId], [ownerId+updatedAt], status, versionId',
  payloads: 'id, ownerId',
  modes: 'id, ownerId',
  vaults: 'ownerId',
})
db.version(2).stores({intents: 'ownerId'})
const markerId = (owner: string, note: string) => `${owner}:${note}`
function changed() {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event('note-recovery-changed'))
}
async function locked<T>(
  ownerId: string,
  action: () => Promise<T>,
): Promise<T> {
  if (typeof navigator === 'undefined' || !navigator.locks)
    throw new Error('Encrypted browser storage requires Web Locks')
  return navigator.locks.request(`eton-note-writes:${ownerId}`, action)
}
// Only new encrypted notes are initialized. Conversion is deliberately absent.
export async function initializeEncryptedNote(ownerId: string, noteId: string) {
  return locked(ownerId, () =>
    db.transaction('rw', db.modes, async () => {
      const id = markerId(ownerId, noteId)
      const previous = await db.modes.get(id)
      if (previous) return previous.epoch
      await db.modes.add({
        id,
        ownerId,
        stableNoteId: noteId,
        epoch: 0,
        mode: 'encrypted',
      })
      return 0
    }),
  )
}
export function canCommitCheckpoint(
  previous: RecoveryHeader | undefined,
  next: RecoveryHeader,
  expectedFlight = next.mutationId,
  expectedGeneration?: number,
) {
  if (!previous)
    return expectedGeneration === undefined || expectedGeneration === -1
  return (
    (expectedGeneration === undefined ||
      previous.generation === expectedGeneration) &&
    next.generation > previous.generation &&
    previous.ownerId === next.ownerId &&
    previous.stableNoteId === next.stableNoteId &&
    previous.capturedEpoch === next.capturedEpoch &&
    previous.mutationId === expectedFlight
  )
}
export async function putEncryptedRecovery(
  root: CryptoKey,
  payload: RecoveryPayload,
  metadata: Pick<RecoveryHeader, 'updatedAt' | 'status' | 'versionId'>,
  expectedFlight = payload.route.mutationId,
  expectedGeneration?: number,
  destinationGuard?: {
    sourceRecordId: string
    versions: {id: string; generation: number}[]
  },
) {
  const {record: checked, serialized} = prepareRecoveryPayload(
    payload,
    payload.route,
  )
  const envelope = await sealRecoveryBytes(root, checked.route, serialized)
  const encodedBytes = recoveryEnvelopeBytes(envelope)
  if (encodedBytes > RECOVERY_STORED_LIMIT)
    throw new Error('Recovery record exceeds storage limit')
  const header: RecoveryHeader = {
    ...checked.route,
    ...metadata,
    id: checked.route.recordId,
    encodedBytes,
  }
  const committed = await locked(header.ownerId, () =>
    db.transaction('rw', db.headers, db.payloads, db.modes, async () => {
      const marker = await db.modes.get(
        markerId(header.ownerId, header.stableNoteId),
      )
      const source =
        header.sourceNoteId === null
          ? null
          : await db.modes.get(markerId(header.ownerId, header.sourceNoteId))
      if (
        !marker ||
        marker.epoch !== header.capturedEpoch ||
        (header.sourceNoteId !== null &&
          (!source || source.epoch !== header.sourceEpoch))
      )
        return false
      if (destinationGuard) {
        const expected = new Map(
          destinationGuard.versions.map((row) => [row.id, row.generation]),
        )
        let changed = false
        await db.headers
          .where('[ownerId+stableNoteId]')
          .equals([header.ownerId, header.stableNoteId])
          .each((row) => {
            if (
              row.status === 'retained' ||
              row.id === destinationGuard.sourceRecordId
            )
              return
            if (expected.get(row.id) !== row.generation) changed = true
            expected.delete(row.id)
          })
        if (changed || expected.size) return false
      }
      if (
        !canCommitCheckpoint(
          await db.headers.get(header.id),
          header,
          expectedFlight,
          expectedGeneration,
        )
      )
        return false
      await db.payloads.put({id: header.id, ownerId: header.ownerId, envelope})
      await db.headers.put(header)
      return true
    }),
  )
  if (committed) changed()
  return committed
}
export function recoveryEnvelopeBytes(envelope: SealedEnvelope) {
  // Locally sealed fields contain only base64url ASCII. Count the exact JSON
  // representation without serializing and allocating another large string.
  const overhead = JSON.stringify({salt: '', iv: '', ciphertext: ''}).length
  return (
    overhead +
    envelope.salt.length +
    envelope.iv.length +
    envelope.ciphertext.length
  )
}
export async function listEncryptedRecovery(
  ownerId: string,
  offset = 0,
  limit = 50,
) {
  return db.headers
    .where('[ownerId+updatedAt]')
    .between([ownerId, Dexie.minKey], [ownerId, Dexie.maxKey])
    .reverse()
    .offset(Math.max(0, offset))
    .limit(Math.min(50, Math.max(1, limit)))
    .toArray()
}
export async function listEncryptedNoteRecovery(
  ownerId: string,
  noteId: string,
  offset = 0,
) {
  return db.headers
    .where('[ownerId+stableNoteId]')
    .equals([ownerId, noteId])
    .offset(offset)
    .limit(50)
    .toArray()
}
export async function findEncryptedWorkingRecovery(
  ownerId: string,
  noteId: string,
) {
  // Walk headers only, retaining one candidate. List-page limits do not apply
  // to locating the working checkpoint, and no historical payload is read.
  let latest: RecoveryHeader | undefined
  await db.headers
    .where('[ownerId+stableNoteId]')
    .equals([ownerId, noteId])
    .each((header) => {
      if (
        header.status !== 'retained' &&
        (!latest || header.updatedAt > latest.updatedAt)
      )
        latest = header
    })
  return latest
}
export async function getEncryptedRecoveryHeader(ownerId: string, id: string) {
  const header = await db.headers.get(id)
  if (!header || header.ownerId !== ownerId || header.id !== header.recordId)
    throw new Error('Recovery unavailable')
  return header
}
export async function openEncryptedRecovery(
  root: CryptoKey,
  ownerId: string,
  id: string,
) {
  const pair = await db.transaction(
    'r',
    db.headers,
    db.payloads,
    db.modes,
    async () => {
      const header = await db.headers.get(id)
      if (
        !header ||
        header.ownerId !== ownerId ||
        header.id !== id ||
        header.recordId !== id
      )
        throw new Error('Recovery unavailable')
      const marker = await db.modes.get(markerId(ownerId, header.stableNoteId))
      if (
        !marker ||
        marker.epoch !== header.capturedEpoch ||
        header.status === 'quarantined'
      )
        throw new Error('Recovery requires reconciliation')
      const record = await db.payloads.get(id)
      if (!record || record.ownerId !== ownerId)
        throw new Error('Recovery unavailable')
      return {header, envelope: record.envelope}
    },
  )
  const route = recoveryRouteFromHeader(pair.header)
  const opened = validateRecoveryPayload(
    await openRecovery(root, route, pair.envelope),
    route,
  )
  await locked(ownerId, async () => {
    const marker = await db.modes.get(
      markerId(ownerId, pair.header.stableNoteId),
    )
    const source =
      pair.header.sourceNoteId === null
        ? null
        : await db.modes.get(markerId(ownerId, pair.header.sourceNoteId))
    if (
      !marker ||
      marker.epoch !== pair.header.capturedEpoch ||
      (pair.header.sourceNoteId !== null &&
        source?.epoch !== pair.header.sourceEpoch)
    )
      throw new Error('Recovery requires reconciliation')
  })
  return opened
}
export async function clearEncryptedRecovery(
  ownerId: string,
  id: string,
  generation: number,
) {
  await locked(ownerId, () =>
    db.transaction('rw', db.headers, db.payloads, db.modes, async () => {
      const header = await db.headers.get(id)
      if (
        !header ||
        header.ownerId !== ownerId ||
        header.generation !== generation
      )
        return
      const marker = await db.modes.get(markerId(ownerId, header.stableNoteId))
      if (!marker || marker.epoch !== header.capturedEpoch) return
      if (header.sourceNoteId !== null) {
        const source = await db.modes.get(
          markerId(ownerId, header.sourceNoteId),
        )
        if (!source || source.epoch !== header.sourceEpoch) return
      }
      await db.headers.delete(id)
      await db.payloads.delete(id)
    }),
  )
  changed()
}
export async function clearEncryptedAccountStorage(ownerId: string) {
  const remove = () =>
    db.transaction(
      'rw',
      db.headers,
      db.payloads,
      db.modes,
      db.vaults,
      db.intents,
      async () => {
        await db.headers.where('ownerId').equals(ownerId).delete()
        await db.payloads.where('ownerId').equals(ownerId).delete()
        await db.modes.where('ownerId').equals(ownerId).delete()
        await db.vaults.delete(ownerId)
        await db.intents.delete(ownerId)
      },
    )
  if (typeof navigator !== 'undefined' && navigator.locks)
    await locked(ownerId, remove)
  else await remove()
  changed()
}
const cachedVaultSchema = z
  .strictObject({
    id: canonicalIdSchema,
    ownerId: canonicalIdSchema,
    revision: z.uuid(),
    setupId: z.uuid(),
    lastOperationId: z.uuid(),
    authorizationVersion: z.union([z.literal(0), z.literal(1)]).default(0),
    authorization: z
      .unknown()
      .optional()
      .transform((value) => {
        const parsed = authorizationSchema.safeParse(value)
        return parsed.success ? parsed.data : null
      }),
    primaryWrapper: vaultWrapperSchema,
    recoveryWrapper: vaultWrapperSchema,
  })
  .refine(
    (v) =>
      v.primaryWrapper.ownerId === v.ownerId &&
      v.recoveryWrapper.ownerId === v.ownerId &&
      v.primaryWrapper.vaultId === v.id &&
      v.recoveryWrapper.vaultId === v.id &&
      v.recoveryWrapper.purpose === 'recovery' &&
      v.primaryWrapper.purpose !== 'recovery',
  )
export async function cacheConfirmedVault(input: ConfirmedVault) {
  const vault = cachedVaultSchema.parse(input)
  await db.vaults.put({
    ownerId: vault.ownerId,
    vaultId: vault.id,
    revision: vault.revision,
    publicVault: vault,
  })
}
export async function getCachedVault(
  ownerId: string,
): Promise<ConfirmedVault | null> {
  const entry = await db.vaults.get(ownerId)
  return entry ? cachedVaultSchema.parse(entry.publicVault) : null
}

export async function saveReplacementIntent(
  input: SignedReplacement,
  assertCurrent: () => void,
) {
  const request = signedReplacementSchema.parse(input)
  await locked(request.ownerId, () =>
    db.transaction('rw', db.intents, async () => {
      const previous = await db.intents.get(request.ownerId)
      assertCurrent()
      if (
        previous &&
        JSON.stringify(previous.request) !== JSON.stringify(request)
      )
        throw new Error('An earlier replacement needs reconciliation')
      await db.intents.put({ownerId: request.ownerId, request})
    }),
  )
}
export async function getReplacementIntent(ownerId: string) {
  const row = await db.intents.get(ownerId)
  if (!row) return null
  const request = signedReplacementSchema.parse(row.request)
  if (request.ownerId !== ownerId) throw new Error('Invalid replacement owner')
  return request
}
export async function clearReplacementIntent(
  ownerId: string,
  request: SignedReplacement,
) {
  await locked(ownerId, () =>
    db.transaction('rw', db.intents, async () => {
      if (
        JSON.stringify((await db.intents.get(ownerId))?.request) ===
        JSON.stringify(signedReplacementSchema.parse(request))
      )
        await db.intents.delete(ownerId)
    }),
  )
}
