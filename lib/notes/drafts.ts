import {Dexie, type EntityTable} from 'dexie'
import type {Note} from '~/db/schema/notes'
import type {NoteSnapshot, SyncRequest} from './sync'

export type RecoveryDraft = {
  id: string
  ownerId: string
  noteId: string | null
  creationId: string
  baseline: Partial<Note>
  draft: NoteSnapshot
  generation: number
  updatedAt: number
  flight?: SyncRequest
  conflict?: Note
  unavailable?: boolean
  // Stable across session handoffs; indexed fields and legacy records are unchanged.
  versionId?: string
  editedCopyOf?: string
  retainedSource?: boolean
}
const db = new Dexie('etoN-note-recovery') as Dexie & {
  drafts: EntityTable<RecoveryDraft, 'id'>
}
db.version(1).stores({drafts: 'id, ownerId, [ownerId+noteId], updatedAt'})

function changed() {
  window.dispatchEvent(new Event('note-recovery-changed'))
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('eton-note-recovery')
    channel.postMessage('changed')
    channel.close()
  }
}
export async function putDraft(record: RecoveryDraft) {
  await db.transaction('rw', db.drafts, async () => {
    const previous = await db.drafts.get(record.id)
    if (!previous || previous.generation <= record.generation)
      await db.drafts.put(record)
  })
  changed()
}
export async function clearDraft(id: string, generation: number) {
  await db.transaction('rw', db.drafts, async () => {
    const current = await db.drafts.get(id)
    if (current && current.generation <= generation) await db.drafts.delete(id)
  })
  changed()
}
export async function clearDraftBatch(
  ownerId: string,
  records: Pick<RecoveryDraft, 'id' | 'generation'>[],
) {
  let newer = 0
  await db.transaction('rw', db.drafts, async () => {
    for (const record of records) {
      const current = await db.drafts.get(record.id)
      if (!current || current.ownerId !== ownerId) continue
      if (current.generation !== record.generation) {
        newer++
        continue
      }
      await db.drafts.delete(record.id)
    }
  })
  changed()
  return {newer}
}
export const listDrafts = (ownerId: string) =>
  db.drafts.where('ownerId').equals(ownerId).reverse().sortBy('updatedAt')
export async function clearAccountDrafts(ownerId: string) {
  await db.drafts.where('ownerId').equals(ownerId).delete()
  changed()
}

// Export only on an explicit user action. The file contains plaintext HTML.
export function exportDrafts(records: RecoveryDraft[]) {
  const blob = new Blob([JSON.stringify(records, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'eton-unsynced-notes.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
