import {sql, type InferInsertModel, type InferSelectModel} from 'drizzle-orm'
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import {enumFromArray} from '../../util'

export const rolePgEnum = pgEnum('role', ['archivist', 'note-taker'])
export type Role = (typeof rolePgEnum.enumValues)[number]
export const RoleEnum = enumFromArray(rolePgEnum.enumValues)

export const usersTable = pgTable('users', {
  id: uuid('id')
    .default(sql`generate_ulid()`)
    .primaryKey(),
  name: varchar('name', {length: 100}).notNull(),
  email: varchar('email', {length: 100}).notNull().unique(),
  image: text('image'),
  role: rolePgEnum('role').default('note-taker').notNull(),
  pendingDeleteAt: timestamp('pending_deleted_at', {withTimezone: true}),
  updatedAt: timestamp('updated_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
  createdAt: timestamp('created_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
})

export type User = InferSelectModel<typeof usersTable>
export type NewUser = Omit<
  InferInsertModel<typeof usersTable>,
  'id' | 'createdAt' | 'updatedAt'
>
export type UpdateUser = Omit<NewUser, 'email'>
