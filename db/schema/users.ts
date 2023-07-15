import {sql, type InferModel} from 'drizzle-orm'
import {
  pgTable,
  text,
  varchar,
  timestamp,
  pgEnum,
  uuid,
} from 'drizzle-orm/pg-core'
import {enumFromArray} from '~/types'

const roleEnum = pgEnum('role', ['archivist', 'note-taker'])
export type Role = (typeof roleEnum.enumValues)[number]
export const RoleEnum = enumFromArray(roleEnum.enumValues)

export const UsersTable = pgTable('users', {
  id: uuid('id')
    .default(sql`generate_ulid()`)
    .primaryKey(),
  name: varchar('name', {length: 100}).notNull(),
  email: varchar('email', {length: 100}).notNull().unique(),
  image: text('image'),
  role: roleEnum('role').default('note-taker').notNull(),
  pendingDeleteAt: timestamp('pending_deleted_at', {withTimezone: true}),
  updatedAt: timestamp('updated_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
  createdAt: timestamp('created_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
})

export type User = InferModel<typeof UsersTable>
export type NewUser = Omit<
  InferModel<typeof UsersTable, 'insert'>,
  'id' | 'createdAt' | 'updatedAt'
>
export type UpdateUser = Omit<NewUser, 'email'>
