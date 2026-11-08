import sanitizeHtml from 'sanitize-html'
import {sanitizeNoteHtml} from './html'
import type {NotePreview, NoteCursor} from './pages'

export const NOTE_SEARCH_PAGE_SIZE = 24
export const NOTE_SEARCH_QUERY_LIMIT = 256
export const NOTE_SEARCH_SNIPPET_LENGTH = 240

export function normalizeSearchText(text: string) {
  return text.normalize('NFC').replace(/\s+/gu, ' ').trim()
}

// Parse with the display sanitizer first. Its HTML parser decodes all entities;
// the second pass only has the sanitizer's escaped &, <, > and quotes to undo.
// Inline marks have no boundary; block elements and explicit breaks do.
export function searchableNoteText(html: string | null) {
  const clean = sanitizeNoteHtml(html)
  const block = /^(p|h[1-6]|blockquote|ul|ol|li|pre|br|hr)$/
  const parts: string[] = []
  sanitizeHtml(clean, {
    allowedTags: [],
    allowedAttributes: {},
    parseStyleAttributes: false,
    onOpenTag(name) {
      if (block.test(name)) parts.push(' ')
    },
    onCloseTag(name) {
      if (block.test(name)) parts.push(' ')
    },
    textFilter(text) {
      parts.push(
        text.replace(
          /&(amp|lt|gt|quot);/g,
          (_, name: string) => ({amp: '&', lt: '<', gt: '>', quot: '"'})[name]!,
        ),
      )
      return ''
    },
  })
  return normalizeSearchText(parts.join(''))
}

export function foldSearchText(text: string) {
  return normalizeSearchText(text).toLowerCase().normalize('NFC')
}

export function searchPattern(query: string) {
  return `%${foldSearchText(query).replace(/[\\%_]/g, '\\$&')}%`
}

// No language-specific minimum query length: this only chooses an execution
// strategy. pg_trgm cannot extract a substring trigram from shorter word runs.
export function hasSearchTrigram(query: string) {
  return /[\p{L}\p{N}]{3}/u.test(foldSearchText(query))
}

// Browser drafts must be matched against the same version displayed on their
// card. A null result suppresses an older server hit for that identity.
export function matchNoteSearch(
  note: {title: string | null; content: string | null; isEncrypted?: boolean},
  rawQuery: string,
): {snippet: string} | null {
  return matchNoteSearchText(
    {
      title: searchableNoteText(note.title),
      body: note.isEncrypted ? '' : searchableNoteText(note.content),
    },
    rawQuery,
    note.isEncrypted,
  )
}

export type NoteSearchText = {title: string; body: string}

export function matchNoteSearchText(
  text: NoteSearchText,
  rawQuery: string,
  isEncrypted = false,
): {snippet: string} | null {
  const query = foldSearchText(rawQuery)
  if (!query || normalizeSearchText(rawQuery).length > NOTE_SEARCH_QUERY_LIMIT)
    return null
  const title = text.title
  const body = isEncrypted ? '' : text.body
  const hit = foldSearchText(body).indexOf(query)
  if (!foldSearchText(title).includes(query) && hit < 0) return null
  const points = Array.from(body)
  let lo = 0
  let hi = points.length
  if (hit >= 0) {
    while (lo < hi) {
      const middle = Math.ceil((lo + hi) / 2)
      if (foldSearchText(points.slice(0, middle).join('')).length <= hit)
        lo = middle
      else hi = middle - 1
    }
  }
  const start = Math.max(0, lo - Math.floor(NOTE_SEARCH_SNIPPET_LENGTH / 3))
  const end = start + NOTE_SEARCH_SNIPPET_LENGTH
  return {
    snippet:
      (start ? '…' : '') +
      points.slice(start, end).join('') +
      (end < points.length ? '…' : ''),
  }
}

export type NoteSearchMatch = NotePreview & {
  revision: string
  isEncrypted: boolean
  snippet: string
}
export type NoteSearchPage = {
  notes: NoteSearchMatch[]
  nextCursor: NoteCursor | null
}

export class NoteSearchNotReadyError extends Error {
  constructor() {
    super('Note search backfill is incomplete')
  }
}
