import {sql} from 'drizzle-orm'
import {check, pgTable, text, timestamp, uuid} from 'drizzle-orm/pg-core'
import {usersTable} from './users'

export const userAppearanceTable = pgTable(
  'user_appearance',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => usersTable.id, {onDelete: 'cascade'}),
    appearance: text('appearance').notNull(),
    mode: text('mode').notNull(),
    updatedAt: timestamp('updated_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      'user_appearance_preset_check',
      sql`${table.appearance} in ('paper-ink', 'sepia', 'midnight', 'bookish')`,
    ),
    check(
      'user_appearance_mode_check',
      sql`${table.mode} in ('system', 'light', 'dark')`,
    ),
  ],
)
