import type {Note} from '~/db/schema/notes'
import type {RecoveryDraft} from '~/lib/notes/drafts'
import {
  beginNoteSync,
  getNoteSync,
  type NoteSyncSession,
} from '~/lib/notes/session-sync'

export async function selectNoteVersion(
  ownerId: string,
  key: string,
  note?: Note,
  record?: RecoveryDraft,
) {
  const {controller, ready} = beginNoteSync(
    ownerId,
    key,
    note,
    record,
    !record,
    Boolean(record),
  )
  await ready
  if (!controller || getNoteSync() !== controller) return
  return controller
}

export function writeNoteSelection(
  controller: NoteSyncSession,
  record?: RecoveryDraft,
) {
  const version = record
    ? ((controller.localSafe ? controller.record.versionId : undefined) ??
      record.versionId ??
      record.id)
    : 'saved'
  const url = new URL(window.location.href)
  url.searchParams.set('version', version)
  if (controller.record.conflict) url.searchParams.set('review', '1')
  else url.searchParams.delete('review')
  window.history.replaceState(null, '', url.href)
}
