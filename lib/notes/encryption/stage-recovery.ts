import {openNote} from './crypto'
import {hasPendingEncryptedEdits, type RecoveryPayload} from './recovery'
import {
  initializeEncryptedNote,
  listEncryptedNoteRecovery,
  openEncryptedRecovery,
  putEncryptedRecovery,
} from './storage'
import {fetchEncryptedNote, type EncryptedRemote} from './sync'

// Staging never uploads or reuses the source's refused immutable request.
export async function stageEncryptedRecovery(
  root: CryptoKey,
  source: RecoveryPayload,
  target: EncryptedRemote | null,
  valid: () => boolean,
) {
  const {ownerId, vaultId} = source.route
  if (!source.refusal || !valid()) throw new Error('Recovery unavailable')
  const noteId = target?.id ?? crypto.randomUUID()
  let baseline: RecoveryPayload['baseline'] = null
  const versions: {id: string; generation: number}[] = []
  if (target) {
    const latest = await fetchEncryptedNote(noteId)
    if (
      !latest ||
      latest.id !== noteId ||
      latest.authorId !== ownerId ||
      latest.encryptedPayload.vaultId !== vaultId ||
      latest.deletedAt ||
      latest.pendingDeleteAt ||
      latest.revision !== target.revision
    )
      throw new Error('Destination changed')
    baseline = {
      ...(await openNote(root, ownerId, latest.encryptedPayload, {
        vaultId,
        noteId,
      })),
      theme: latest.theme,
    }
    for (let offset = 0; ; offset += 50) {
      const rows = await listEncryptedNoteRecovery(ownerId, noteId, offset)
      for (const row of rows) {
        if (row.status === 'retained' || row.id === source.route.recordId)
          continue
        const local = await openEncryptedRecovery(root, ownerId, row.id)
        if (
          !local.baselineVerified ||
          hasPendingEncryptedEdits(local) ||
          local.conflict ||
          local.refusal
        )
          throw new Error('Destination has browser work')
        versions.push({id: row.id, generation: row.generation})
      }
      if (rows.length < 50) break
    }
  }
  const capturedEpoch = await initializeEncryptedNote(ownerId, noteId)
  const record: RecoveryPayload = {
    version: 1,
    route: {
      ...source.route,
      stableNoteId: noteId,
      recordId: crypto.randomUUID(),
      generation: 0,
      capturedEpoch,
      noteId: target ? noteId : null,
      creationId: noteId,
      sourceNoteId: source.route.stableNoteId,
      sourceEpoch: source.route.capturedEpoch,
      mutationId: null,
      flightDestination: null,
      expectedRevision: target?.revision ?? null,
    },
    baseline,
    baselineVerified: true,
    draft: structuredClone(source.draft),
    conflict: baseline,
    conflictRevision: target?.revision ?? null,
    flight: null,
    resolution: null,
  }
  if (!valid()) throw new Error('Vault locked')
  if (
    !(await putEncryptedRecovery(
      root,
      record,
      {
        status: target ? 'conflict' : 'local',
        versionId: record.route.recordId,
        updatedAt: Date.now(),
      },
      undefined,
      -1,
      {sourceRecordId: source.route.recordId, versions},
    ))
  )
    throw new Error('Recovery could not be retained')
  return {noteId, recordId: record.route.recordId, creating: !target}
}
