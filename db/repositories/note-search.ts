import 'server-only'

import {and, eq, isNull, or, sql} from 'drizzle-orm'
import type {PostgresJsDatabase} from 'drizzle-orm/postgres-js'
import {notesTable} from '../schema/notes'
import {noteSearchDocumentsTable as documents} from '../schema/note-search'
import {
  foldSearchText,
  hasSearchTrigram,
  normalizeSearchText,
  NOTE_SEARCH_PAGE_SIZE,
  NOTE_SEARCH_QUERY_LIMIT,
  NOTE_SEARCH_SNIPPET_LENGTH,
  NoteSearchNotReadyError,
  searchableNoteText,
  searchPattern,
  type NoteSearchPage,
} from '../../lib/notes/search'
import {noteIdSchema} from '../../lib/notes/validation'
import type {NoteCursor} from '../../lib/notes/pages'
import {sanitizeNoteHtml} from '../../lib/notes/html'

type SearchDatabase = Pick<
  PostgresJsDatabase,
  'select' | 'insert' | 'transaction'
>
type Source = {
  id: string
  revision: string
  title: string | null
  content: string | null
  isEncrypted: boolean
}

export async function writeSearchDocument(
  db: Pick<SearchDatabase, 'insert' | 'select'>,
  note: Source,
) {
  // Caller holds a transaction. A retry/conflict may contain an older snapshot;
  // never let it overwrite a newer projection after waiting on another writer.
  const [current] = await db
    .select({revision: notesTable.revision, indexedId: documents.noteId})
    .from(notesTable)
    .leftJoin(documents, eq(documents.noteId, notesTable.id))
    .where(eq(notesTable.id, note.id))
    .for('share', {of: notesTable})
  if (!current || current.revision !== note.revision) return
  // The source-change trigger invalidates projections atomically. Theme edits,
  // restore and idempotent acknowledgements reuse one; missing legacy rows heal.
  if (current.indexedId) return
  const titleText = searchableNoteText(note.title)
  const bodyText = note.isEncrypted ? null : searchableNoteText(note.content)
  const document = {
    noteId: note.id,
    titleText,
    bodyText,
    titleFold: foldSearchText(titleText),
    bodyFold: bodyText === null ? null : foldSearchText(bodyText),
  }
  await db.insert(documents).values(document).onConflictDoUpdate({
    target: documents.noteId,
    set: document,
  })
}

// A resumable data migration. Row locks serialize with editor writes, encryption
// transitions and deletion; filling this table never changes editor revisions.
export async function backfillNoteSearch(db: SearchDatabase, batchSize = 50) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100)
    throw new Error('Invalid search backfill batch size')
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: notesTable.id,
        revision: notesTable.revision,
        title: notesTable.title,
        content: notesTable.content,
        isEncrypted: notesTable.isEncrypted,
      })
      .from(notesTable)
      .leftJoin(documents, eq(documents.noteId, notesTable.id))
      .where(isNull(documents.noteId))
      .orderBy(notesTable.id)
      .limit(batchSize)
      .for('update', {of: notesTable})
    for (const note of rows) await writeSearchDocument(tx, note)
    return rows.length
  })
}

export function createNoteSearchRepository(db: SearchDatabase) {
  return {
    async search(
      ownerId: string,
      rawQuery: string,
      cursor: NoteCursor | null = null,
    ): Promise<NoteSearchPage> {
      const query = normalizeSearchText(rawQuery)
      if (
        !noteIdSchema.safeParse(ownerId).success ||
        !query ||
        query.length > NOTE_SEARCH_QUERY_LIMIT
      )
        return {notes: [], nextCursor: null}
      return db.transaction(
        async (tx) => {
          // Never turn incomplete rollout/import data into a false "no matches".
          const missing = await tx
            .select({id: notesTable.id})
            .from(notesTable)
            .leftJoin(documents, eq(documents.noteId, notesTable.id))
            .where(
              and(
                eq(notesTable.authorId, ownerId),
                isNull(notesTable.pendingDeleteAt),
                isNull(documents.noteId),
              ),
            )
            .limit(1)
          if (missing.length) throw new NoteSearchNotReadyError()
          const pattern = searchPattern(query)
          const folded = foldSearchText(query)
          const indexed = hasSearchTrigram(query)
          // LIMIT 1 preserves the correlated primary-key lookup. Short/symbol
          // queries inspect only this owner's notes, using note_id lookups,
          // instead of a planner-selected scan of every account's long bodies.
          const ownerSource = tx
            .select()
            .from(documents)
            .where(eq(documents.noteId, notesTable.id))
            .limit(1)
            .as('owner_search')
          const source = indexed ? documents : ownerSource
          // Folded offsets can expand (e.g. dotted I). Find the corresponding source
          // offset by folding source prefixes only for the bounded result rows.
          const snippet = sql<string>`note_search_excerpt(${source.bodyText}, ${source.bodyFold}, ${folded}, ${NOTE_SEARCH_SNIPPET_LENGTH})`
          const statement = tx
            .select({
              id: notesTable.id,
              authorId: notesTable.authorId,
              title: notesTable.title,
              theme: notesTable.theme,
              revision: notesTable.revision,
              isEncrypted: notesTable.isEncrypted,
              createdAt: notesTable.createdAt,
              createdOrder: sql<string>`to_char(${notesTable.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
              updatedAt: notesTable.updatedAt,
              pendingDeleteAt: notesTable.pendingDeleteAt,
              snippet: sql<string>`case when ${notesTable.isEncrypted} then '' else ${snippet} end`,
            })
            .from(notesTable)
            .$dynamic()
          const joined = indexed
            ? statement.innerJoin(
                documents,
                eq(documents.noteId, notesTable.id),
              )
            : statement.innerJoinLateral(ownerSource, sql`true`)
          const rows = await joined
            .where(
              and(
                eq(notesTable.authorId, ownerId),
                isNull(notesTable.pendingDeleteAt),
                // Keep the candidate predicate on the document table so PostgreSQL
                // can combine both trigram indexes before applying owner checks.
                or(
                  sql`${source.titleFold} LIKE ${pattern}`,
                  sql`${source.bodyFold} LIKE ${pattern}`,
                ),
                or(
                  eq(notesTable.isEncrypted, false),
                  sql`${source.titleFold} LIKE ${pattern}`,
                ),
                cursor
                  ? sql`(${notesTable.createdAt}, ${notesTable.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
                  : undefined,
              ),
            )
            .orderBy(
              sql`${notesTable.createdAt} desc nulls last`,
              sql`${notesTable.id} desc nulls last`,
            )
            .limit(NOTE_SEARCH_PAGE_SIZE + 1)
          const page = rows.slice(0, NOTE_SEARCH_PAGE_SIZE)
          const last = page.at(-1)
          return {
            // Search cards must use this bounded plain-text snippet. In particular,
            // encrypted title matches never pass body HTML into a shared preview.
            notes: page.map((note) => ({
              ...note,
              title: sanitizeNoteHtml(note.title),
              content: null,
            })),
            nextCursor:
              rows.length > NOTE_SEARCH_PAGE_SIZE && last
                ? {createdAt: last.createdOrder, id: last.id}
                : null,
          }
        },
        {isolationLevel: 'repeatable read', accessMode: 'read only'},
      )
    },
  }
}
