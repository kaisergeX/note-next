import 'server-only'

import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  isNull,
  min,
  sql,
} from 'drizzle-orm'
import type {PostgresJsDatabase} from 'drizzle-orm/postgres-js'
import {
  NOTE_RETENTION_SECONDS,
  type NoteMutationResult,
  type LifecycleNote,
} from '~/lib/notes/lifecycle'
import {
  createNoteSchema,
  deadlineSchema,
  editNoteSchema,
  noteIdSchema,
  trashDraftSchema,
} from '~/lib/notes/validation'
import {notesTable} from '../schema/notes'
import type {TrashIdentity} from '../../lib/notes/trash-bulk'

type NoteDatabase = Pick<
  PostgresJsDatabase,
  'select' | 'insert' | 'update' | 'delete'
>

// Internal factory, not a Server Action. Callers derive ownerId from auth.
// Connection injection lets tests exercise real queries in a disposable database.
export function createNoteRepository(db: NoteDatabase) {
  const projection = {
    ...getTableColumns(notesTable),
    // Preserve PostgreSQL microseconds; Date alone loses precision.
    deadlineToken: sql<
      string | null
    >`to_char(${notesTable.pendingDeleteAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
  }
  const owned = (ownerId: string, noteId?: string) =>
    and(
      eq(notesTable.authorId, ownerId),
      noteId ? eq(notesTable.id, noteId) : undefined,
    )
  const active = isNull(notesTable.pendingDeleteAt)
  const recoverable = gt(notesTable.pendingDeleteAt, sql`now()`)
  const validOwner = (ownerId: string) =>
    noteIdSchema.safeParse(ownerId).success
  const valid = (ownerId: string, noteId: string) =>
    validOwner(ownerId) && noteIdSchema.safeParse(noteId).success
  const result = (rows: LifecycleNote[]): NoteMutationResult =>
    rows[0] ? {status: 'success', note: rows[0]} : {status: 'unavailable'}

  async function getNote(ownerId: string, noteId: string) {
    if (!valid(ownerId, noteId)) return null
    const rows = await db
      .select(projection)
      .from(notesTable)
      .where(and(owned(ownerId, noteId), active))
      .limit(1)
    return rows[0] ?? null
  }
  async function getListNote(ownerId: string) {
    if (!validOwner(ownerId)) return []
    return db
      .select(projection)
      .from(notesTable)
      .where(and(owned(ownerId), active))
      .orderBy(desc(notesTable.createdAt), desc(notesTable.id))
  }
  async function getTrashNote(ownerId: string, noteId: string) {
    if (!valid(ownerId, noteId)) return null
    const rows = await db
      .select(projection)
      .from(notesTable)
      .where(and(owned(ownerId, noteId), recoverable))
      .limit(1)
    return rows[0] ?? null
  }
  async function getTrashNotes(ownerId: string) {
    if (!validOwner(ownerId)) return []
    return db
      .select(projection)
      .from(notesTable)
      .where(and(owned(ownerId), recoverable))
      .orderBy(desc(notesTable.pendingDeleteAt), desc(notesTable.id))
  }
  async function getTrashSummary(ownerId: string) {
    const [summary] = await db
      .select({count: count(), nextExpiry: min(notesTable.pendingDeleteAt)})
      .from(notesTable)
      .where(
        and(
          owned(ownerId),
          gt(notesTable.pendingDeleteAt, sql`clock_timestamp()`),
        ),
      )
    return summary
  }
  async function getTrashIdentities(ownerId: string): Promise<TrashIdentity[]> {
    if (!validOwner(ownerId)) return []
    return db
      .select({
        id: notesTable.id,
        deadlineToken: sql<string>`${projection.deadlineToken}`,
      })
      .from(notesTable)
      .where(
        and(
          owned(ownerId),
          gt(notesTable.pendingDeleteAt, sql`clock_timestamp()`),
        ),
      )
      .orderBy(notesTable.id)
  }
  // Called within the owner transaction, using server-read identities. Exact
  // deadlines protect each trash cycle; the statement clock excludes expiry.
  async function mutateTrashBatch(
    ownerId: string,
    items: TrashIdentity[],
    remove: boolean,
  ) {
    if (
      !validOwner(ownerId) ||
      items.some(
        (item) =>
          !valid(ownerId, item.id) ||
          !deadlineSchema.safeParse(item.deadlineToken).success,
      )
    )
      throw new Error('Invalid trash batch')
    if (!items.length) return []
    const values = sql.join(
      items.map(
        (item) => sql`(${item.id}::uuid, ${item.deadlineToken}::timestamptz)`,
      ),
      sql`, `,
    )
    const predicate = and(
      owned(ownerId),
      gt(notesTable.pendingDeleteAt, sql`clock_timestamp()`),
      sql`(${notesTable.id}, ${notesTable.pendingDeleteAt}) IN (VALUES ${values})`,
    )
    return remove
      ? db.delete(notesTable).where(predicate).returning({id: notesTable.id})
      : db
          .update(notesTable)
          .set({pendingDeleteAt: null})
          .where(predicate)
          .returning({id: notesTable.id})
  }
  async function createNote(
    ownerId: string,
    input: unknown,
  ): Promise<NoteMutationResult> {
    const parsed = createNoteSchema.safeParse(input)
    if (!validOwner(ownerId) || !parsed.success)
      return {status: 'invalid_input'}
    return result(
      await db
        .insert(notesTable)
        .values({...parsed.data, authorId: ownerId, pendingDeleteAt: null})
        .returning(projection),
    )
  }
  async function updateNote(
    ownerId: string,
    noteId: string,
    input: unknown,
  ): Promise<NoteMutationResult> {
    const parsed = editNoteSchema.safeParse(input)
    if (!valid(ownerId, noteId) || !parsed.success)
      return {status: 'invalid_input'}
    return result(
      await db
        .update(notesTable)
        .set(parsed.data)
        .where(and(owned(ownerId, noteId), active))
        .returning(projection),
    )
  }
  async function moveNoteToTrash(
    ownerId: string,
    noteId: string,
    draft?: unknown,
  ): Promise<NoteMutationResult> {
    const parsed =
      draft === undefined ? undefined : trashDraftSchema.safeParse(draft)
    if (!valid(ownerId, noteId) || (parsed && !parsed.success))
      return {status: 'invalid_input'}
    const rows = await db
      .update(notesTable)
      .set({
        ...(parsed?.success ? parsed.data : {}),
        // Use the actual transition clock even inside a longer transaction. Seconds
        // are elapsed time; calendar days vary across daylight-saving changes.
        pendingDeleteAt: sql`clock_timestamp() + ${NOTE_RETENTION_SECONDS} * interval '1 second'`,
      })
      .where(and(owned(ownerId, noteId), active))
      .returning(projection)
    if (rows[0]) return {status: 'success', note: rows[0]}
    const current = await getTrashNote(ownerId, noteId)
    return current
      ? {status: 'already_applied', note: current}
      : {status: 'unavailable'}
  }
  async function mutateTrash(
    ownerId: string,
    noteId: string,
    expectedDeadline: unknown,
    remove: boolean,
  ): Promise<NoteMutationResult> {
    const token = deadlineSchema.safeParse(expectedDeadline)
    if (!valid(ownerId, noteId) || !token.success)
      return {status: 'invalid_input'}
    const predicate = and(
      owned(ownerId, noteId),
      recoverable,
      eq(notesTable.pendingDeleteAt, sql`${token.data}::timestamptz`),
    )
    const rows = remove
      ? await db.delete(notesTable).where(predicate).returning(projection)
      : await db
          .update(notesTable)
          .set({pendingDeleteAt: null})
          .where(predicate)
          .returning(projection)
    if (rows[0]) return {status: 'success', note: rows[0]}
    // Only classify a currently owner-visible recoverable row. Other states share
    // unavailable; don't infer completion of a request we haven't recorded.
    return (await getTrashNote(ownerId, noteId))
      ? {status: 'conflict'}
      : {status: 'unavailable'}
  }
  async function getServerTime() {
    const [clock] = await db
      .select({
        now: sql<number>`extract(epoch from clock_timestamp())::double precision * 1000`,
      })
      .from(sql`(select 1) as clock`)
    return clock.now
  }
  return {
    getServerTime,
    getNote,
    getListNote,
    getTrashNote,
    getTrashNotes,
    getTrashSummary,
    getTrashIdentities,
    mutateTrashBatch,
    createNote,
    updateNote,
    moveNoteToTrash,
    restoreNote: (ownerId: string, noteId: string, deadline: unknown) =>
      mutateTrash(ownerId, noteId, deadline, false),
    permanentlyDeleteTrashedNote: (
      ownerId: string,
      noteId: string,
      deadline: unknown,
    ) => mutateTrash(ownerId, noteId, deadline, true),
  }
}
