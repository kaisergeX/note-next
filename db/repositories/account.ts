import 'server-only'
import {createHash} from 'node:crypto'

import {and, count, eq, isNull, sql} from 'drizzle-orm'
import type {PostgresJsDatabase} from 'drizzle-orm/postgres-js'
import {usersTable} from '../schema/users'
import {notesTable} from '../schema/notes'
import {featureAccessTable} from '../schema/feature-access'
import {userAppearanceTable} from '../schema/user-appearance'
import {
  NOTE_RETENTION_SECONDS,
  type NoteMutationResult,
} from '../../lib/notes/lifecycle'
import {createNoteRepository} from './notes'
import type {TrashIdentity, TrashPreview} from '../../lib/notes/trash-bulk'

type AccountDatabase = Pick<
  PostgresJsDatabase,
  'select' | 'transaction' | 'insert' | 'update' | 'delete'
>

export function createAccountRepository(db: AccountDatabase) {
  function trashSnapshot(ownerId: string, items: TrashIdentity[]) {
    return createHash('sha256')
      .update(JSON.stringify([ownerId, items]))
      .digest('hex')
  }
  async function previewTrash(ownerId: string): Promise<TrashPreview> {
    const items = await createNoteRepository(db).getTrashIdentities(ownerId)
    return {count: items.length, snapshot: trashSnapshot(ownerId, items)}
  }
  async function activeNoteCount(ownerId: string) {
    const [row] = await db
      .select({count: count()})
      .from(notesTable)
      .where(
        and(
          eq(notesTable.authorId, ownerId),
          isNull(notesTable.pendingDeleteAt),
        ),
      )
    return row.count
  }

  // All interactive note writes take the same user lock. Bulk deletion cannot
  // interleave with a save/restore, or leave dependencies behind account deletion.
  async function withOwner<T>(
    ownerId: string,
    run: (
      tx: Parameters<Parameters<PostgresJsDatabase['transaction']>[0]>[0],
    ) => Promise<T>,
  ) {
    return db.transaction(async (tx) => {
      const [user] = await tx
        .select({id: usersTable.id})
        .from(usersTable)
        .where(eq(usersTable.id, ownerId))
        .for('update')
      if (!user) return null
      return run(tx)
    })
  }

  async function moveAllNotesToTrash(ownerId: string) {
    return withOwner(ownerId, async (tx) => {
      const rows = await tx
        .update(notesTable)
        .set({
          pendingDeleteAt: sql`statement_timestamp() + ${NOTE_RETENTION_SECONDS} * interval '1 second'`,
        })
        .where(
          and(
            eq(notesTable.authorId, ownerId),
            isNull(notesTable.pendingDeleteAt),
          ),
        )
        .returning({id: notesTable.id})
      return {count: rows.length}
    })
  }

  async function deleteAccount(ownerId: string) {
    return withOwner(ownerId, async (tx) => {
      await tx.delete(notesTable).where(eq(notesTable.authorId, ownerId))
      await tx
        .delete(featureAccessTable)
        .where(eq(featureAccessTable.userId, ownerId))
      await tx
        .delete(userAppearanceTable)
        .where(eq(userAppearanceTable.userId, ownerId))
      await tx.delete(usersTable).where(eq(usersTable.id, ownerId))
      return {deleted: true as const}
    })
  }

  async function mutateAllTrash(
    ownerId: string,
    expectedSnapshot: unknown,
    remove: boolean,
  ) {
    if (
      typeof expectedSnapshot !== 'string' ||
      !/^[a-f0-9]{64}$/.test(expectedSnapshot)
    )
      return {status: 'invalid_input' as const}
    return withOwner(ownerId, async (tx) => {
      const repo = createNoteRepository(tx)
      const items = await repo.getTrashIdentities(ownerId)
      if (trashSnapshot(ownerId, items) !== expectedSnapshot)
        return {status: 'conflict' as const}
      const affected = await repo.mutateTrashBatch(ownerId, items, remove)
      return {
        status: 'success' as const,
        count: affected.length,
        ids: affected.map((row) => row.id),
      }
    })
  }

  return {
    activeNoteCount,
    moveAllNotesToTrash,
    deleteAccount,
    previewTrash,
    restoreAllTrash: (ownerId: string, snapshot: unknown) =>
      mutateAllTrash(ownerId, snapshot, false),
    emptyTrash: (ownerId: string, snapshot: unknown) =>
      mutateAllTrash(ownerId, snapshot, true),
    mutateNote: (
      ownerId: string,
      run: (
        repo: ReturnType<typeof createNoteRepository>,
      ) => Promise<NoteMutationResult>,
    ) => withOwner(ownerId, (tx) => run(createNoteRepository(tx))),
  }
}
