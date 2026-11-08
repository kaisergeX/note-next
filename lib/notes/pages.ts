import type {Note} from '~/db/schema/notes'
import {sanitizeNoteHtml} from './html'

export const NOTE_PAGE_SIZE = 24
export const NOTE_PREVIEW_LENGTH = 4096

// Display data only: never use a list preview as an editor baseline.
export type NotePreview = Pick<
  Note,
  | 'id'
  | 'authorId'
  | 'title'
  | 'content'
  | 'theme'
  | 'createdAt'
  | 'updatedAt'
  | 'pendingDeleteAt'
> & {createdOrder?: string}
export type NoteCursor = {createdAt: string; id: string}
export type NotePage = {notes: NotePreview[]; nextCursor: NoteCursor | null}

export function notePreview<T extends NotePreview>(note: T): NotePreview {
  return {
    id: note.id,
    authorId: note.authorId,
    title: sanitizeNoteHtml(note.title?.slice(0, NOTE_PREVIEW_LENGTH) ?? null),
    content: sanitizeNoteHtml(
      note.content?.slice(0, NOTE_PREVIEW_LENGTH) ?? null,
    ),
    theme: note.theme,
    createdAt: note.createdAt,
    createdOrder:
      note.createdOrder ??
      new Date(note.createdAt).toISOString().replace('Z', '000Z'),
    updatedAt: note.updatedAt,
    pendingDeleteAt: note.pendingDeleteAt,
  }
}
