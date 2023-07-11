import type {InferModel} from 'drizzle-orm'
import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core'

const roleEnum = pgEnum('role', ['archivist', 'note-taker'])

export const UsersTable = pgTable(
  'users',
  {
    id: serial('id').primaryKey().notNull(),
    name: varchar('name', {length: 100}).notNull(),
    email: varchar('email', {length: 100}).notNull(),
    image: text('image'),
    role: roleEnum('role').default('note-taker').notNull(),
    createdAt: timestamp('createdAt', {
      withTimezone: true,
      mode: 'string',
    })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      emailKey: uniqueIndex('users_email_key').on(table.email),
    }
  },
)

export type User = InferModel<typeof UsersTable>
export type NewUser = InferModel<typeof UsersTable, 'insert'>
