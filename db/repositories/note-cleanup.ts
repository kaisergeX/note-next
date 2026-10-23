import 'server-only'

import {sql} from 'drizzle-orm'
import type {PostgresJsDatabase} from 'drizzle-orm/postgres-js'
import {
  NOTE_CLEANUP_BATCH_SIZE,
  type DeletedNoteIdentity,
} from '~/lib/notes/cleanup'
import {notesTable} from '../schema/notes'

// Deliberately separate from the owner-scoped repository and Server Actions.
// Only the authenticated scheduler may invoke this cross-owner operation.
export function createNoteCleanupRepository(
  db: Pick<PostgresJsDatabase, 'transaction'>,
) {
  return {
    async deleteExpiredBatch(
      limit: number,
      beforeCommit: (rows: DeletedNoteIdentity[]) => void = () => {},
    ) {
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > NOTE_CLEANUP_BATCH_SIZE
      )
        throw new RangeError('Invalid cleanup batch size')
      return db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL statement_timeout = '5s'`)
        await tx.execute(sql`SET LOCAL lock_timeout = '500ms'`)
        const rows = await tx.execute<DeletedNoteIdentity>(sql`
          WITH due AS (
            SELECT ${notesTable.id}
            FROM ${notesTable}
            WHERE ${notesTable.pendingDeleteAt} <= statement_timestamp()
            ORDER BY ${notesTable.pendingDeleteAt}, ${notesTable.id}
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
          )
          DELETE FROM ${notesTable} USING due
          WHERE ${notesTable.id} = due.id
            AND ${notesTable.pendingDeleteAt} <= statement_timestamp()
          RETURNING ${notesTable.id}, ${notesTable.authorId} AS "authorId"
        `)
        const identities = Array.from(rows)
        beforeCommit(identities)
        return identities
      })
    },
  }
}
