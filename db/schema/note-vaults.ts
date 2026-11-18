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
    authorizationVersion: integer('authorization_version').default(0).notNull(),
    authorization: jsonb('authorization'),
    primaryWrapper: jsonb('primary_wrapper').notNull(),
    recoveryWrapper: jsonb('recovery_wrapper').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('note_vaults_id_owner_unique').on(table.id, table.ownerId),
    check('note_vaults_format_check', sql`${table.formatVersion} = 1`),
    check(
      'note_vaults_authorization_check',
      sql`(${table.authorizationVersion} = 0 AND ${table.authorization} IS NULL) OR (${table.authorizationVersion} = 1 AND ${table.authorization} IS NOT NULL AND jsonb_typeof(${table.authorization}) = 'object' AND coalesce(${table.authorization}->>'version' = '1', false))`,
    ),
  ],
)
