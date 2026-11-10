import {sql} from 'drizzle-orm'
import {
  check,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import {usersTable} from './users'

// Only wrapped keys and public KDF/credential parameters belong in this table.
export const noteVaultsTable = pgTable(
  'note_vaults',
  {
    id: uuid('id').primaryKey(),
    ownerId: uuid('owner_id')
      .notNull()
      .unique()
      .references(() => usersTable.id, {onDelete: 'cascade'}),
    setupId: uuid('setup_id').notNull(),
    revision: uuid('revision').defaultRandom().notNull(),
    lastOperationId: uuid('last_operation_id').notNull(),
    formatVersion: integer('format_version').default(1).notNull(),
    primaryWrapper: jsonb('primary_wrapper').notNull(),
    recoveryWrapper: jsonb('recovery_wrapper').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('note_vaults_id_owner_unique').on(table.id, table.ownerId),
    check('note_vaults_format_check', sql`${table.formatVersion} = 1`),
  ],
)
