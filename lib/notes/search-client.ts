import type {NoteCursor} from './pages'
import {foldSearchText, type NoteSearchPage} from './search'

export type NoteSearchErrorCode = 'failed' | 'not_ready' | 'account_changed'

export class NoteSearchRequestError extends Error {
  constructor(public code: NoteSearchErrorCode) {
    super(code)
  }
}

export const noteSearchKey = (ownerId: string, query: string) =>
  ['note-search', ownerId, foldSearchText(query)] as const

export async function readNoteSearchPage(
  ownerId: string,
  query: string,
  cursor: NoteCursor | null,
  signal: AbortSignal,
): Promise<NoteSearchPage> {
  const response = await fetch('/api/note/search', {
    method: 'POST',
    cache: 'no-store',
    signal,
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({query, cursor}),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new NoteSearchRequestError(
      response.status === 503 && error?.code === 'search_not_ready'
        ? 'not_ready'
        : 'failed',
    )
  }
  const page = (await response.json()) as NoteSearchPage & {ownerId: string}
  if (page.ownerId !== ownerId)
    throw new NoteSearchRequestError('account_changed')
  return {
    nextCursor: page.nextCursor,
    notes: page.notes
      .filter((note) => note.authorId === ownerId)
      .map((note) => ({
        ...note,
        content: null,
        snippet: note.isEncrypted ? '' : note.snippet,
      })),
  }
}
