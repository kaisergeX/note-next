import type {Note} from '~/db/schema/notes'
import {noteText} from './text'

export type NoteSnapshot = Pick<Note, 'title' | 'content' | 'theme'>
export const snapshot = (note: Partial<Note> = {}): NoteSnapshot => ({
  title: note.title || null,
  content: note.content || null,
  theme: note.theme || null,
})
export const sameContent = (a: Partial<Note>, b: Partial<Note>) =>
  (['title', 'content', 'theme'] as const).every(
    (key) => (a[key] || null) === (b[key] || null),
  )

export function meaningfulContent(note: Partial<Note>) {
  return Boolean(
    noteText(note.title ?? null) ||
    noteText(note.content ?? null) ||
    /<hr\b/i.test(note.content ?? ''),
  )
}

export function reconcile(
  base: Partial<Note>,
  local: NoteSnapshot,
  remote: NoteSnapshot,
) {
  const merged = {...local}
  const conflicts: (keyof NoteSnapshot)[] = []
  for (const key of ['title', 'content', 'theme'] as const) {
    const b = base[key] || null,
      l = local[key] || null,
      r = remote[key] || null
    if (l === b || l === r) merged[key] = r as never
    else if (r !== b) conflicts.push(key)
  }
  return {merged, conflicts}
}

export type SyncRequest = {
  ownerId: string
  noteId: string | null
  creationId: string
  mutationId: string
  expectedRevision: string | null
  content: NoteSnapshot
  kind: 'save' | 'trash'
}
export type SyncResult =
  | {status: 'success'; note: Note}
  | {status: 'conflict'; note: Note}
  | {
      status:
        | 'unavailable'
        | 'invalid_input'
        | 'unauthenticated'
        | 'account_changed'
        | 'retryable_error'
    }
