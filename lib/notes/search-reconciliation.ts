import {
  matchNoteSearch,
  matchNoteSearchText,
  type NoteSearchMatch,
  type NoteSearchText,
} from './search'
import type {Note} from '~/db/schema/notes'

export type NoteAcknowledgement = {note: Note; recordedAt: number}

// A successful query supersedes the save overlay even when the saved note is
// absent (e.g. edited, trashed or encrypted on another device).
export function pendingNoteAcknowledgements(
  entries: Record<string, NoteAcknowledgement>,
  reconciledAt: number,
) {
  return Object.fromEntries(
    Object.entries(entries).filter(
      ([, entry]) => entry.recordedAt >= reconciledAt,
    ),
  )
}

export type SearchDisplayOverride = {
  id: string
  ownerId: string
  title: string | null
  content: string | null
  isEncrypted: boolean
  deleted?: boolean
  searchText?: NoteSearchText
}

// Pass only the exact full version selected for a card: a single draft group or
// an acknowledged saved snapshot. Ambiguous hidden versions are not overrides;
// their saved card keeps its authoritative server match. Never match truncated
// list previews, or use this display projection as an editor baseline.
export function reconcileNoteSearch(
  ownerId: string,
  query: string,
  serverMatches: NoteSearchMatch[],
  overrides: SearchDisplayOverride[],
) {
  const matches = new Map<string, string>()
  for (const note of serverMatches)
    if (note.authorId === ownerId && !note.pendingDeleteAt)
      matches.set(note.id, note.isEncrypted ? '' : note.snippet)
  for (const note of overrides) {
    if (note.ownerId !== ownerId) continue
    // A displayed draft that stopped matching must suppress every loaded server
    // hit for that identity, including one fetched on a later search page.
    matches.delete(note.id)
    if (note.deleted) continue
    const match = note.searchText
      ? matchNoteSearchText(note.searchText, query, note.isEncrypted)
      : matchNoteSearch(note, query)
    if (match) matches.set(note.id, match.snippet)
  }
  return matches
}
