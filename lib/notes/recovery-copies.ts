import type {RecoveryDraft} from './drafts'
import {snapshot} from './sync'

// Session IDs and checkpoint times can differ without representing different
// work. Keep distinct baselines, conflicts and retry intents recoverable.
function copyKey(record: RecoveryDraft) {
  return JSON.stringify([
    record.ownerId,
    record.noteId ? `note:${record.noteId}` : `creation:${record.creationId}`,
    snapshot(record.draft),
    record.baseline.revision ?? null,
    snapshot(record.baseline),
    record.unavailable ?? false,
    record.conflict?.revision ?? null,
    snapshot(record.conflict),
    record.flight ?? null,
  ])
}

export function sameRecoveryCopy(a: RecoveryDraft, b: RecoveryDraft) {
  return copyKey(a) === copyKey(b)
}

export const recoveryNoteId = (record: RecoveryDraft) =>
  record.noteId ?? record.creationId

export function noteRecoveryGroups(
  records: RecoveryDraft[],
  ownerId: string,
  noteId: string,
) {
  return groupRecoveryDrafts(
    records.filter(
      (record) =>
        record.ownerId === ownerId && recoveryNoteId(record) === noteId,
    ),
  )
}

// Collection identity is broader than equivalence. Joining versions never
// authorizes deleting them or selecting a winner.
export function groupNoteRecovery(records: RecoveryDraft[]) {
  const notes = new Map<string, RecoveryDraft[]>()
  for (const record of records) {
    const key = recoveryNoteId(record)
    notes.set(key, [...(notes.get(key) ?? []), record])
  }
  return notes
}

export function groupRecoveryDrafts(records: RecoveryDraft[]) {
  const groups = new Map<
    string,
    {record: RecoveryDraft; copies: RecoveryDraft[]}
  >()
  for (const record of records) {
    const key = copyKey(record)
    const group = groups.get(key)
    if (group) {
      group.copies.push(record)
      if (record.updatedAt > group.record.updatedAt) group.record = record
    } else groups.set(key, {record, copies: [record]})
  }
  return [...groups.values()].sort(
    (a, b) => b.record.updatedAt - a.record.updatedAt,
  )
}
