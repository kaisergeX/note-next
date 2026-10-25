import 'server-only'

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

type AccountDatabase = Pick<PostgresJsDatabase, 'select' | 'transaction'>

export function createAccountRepository(db: AccountDatabase) {
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

  return {
    activeNoteCount,
    moveAllNotesToTrash,
    deleteAccount,
    mutateNote: (
      ownerId: string,
      run: (
        repo: ReturnType<typeof createNoteRepository>,
      ) => Promise<NoteMutationResult>,
    ) => withOwner(ownerId, (tx) => run(createNoteRepository(tx))),
  }
}
