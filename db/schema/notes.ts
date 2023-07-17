import {sql, type InferModel} from 'drizzle-orm'
import {pgTable, varchar, text, timestamp, uuid} from 'drizzle-orm/pg-core'
import {UsersTable} from './users'

export const NotesTable = pgTable('notes', {
  id: uuid('id')
    .default(sql`generate_ulid()`)
    .primaryKey(),
  authorId: uuid('author_id')
    .notNull()
    .references(() => UsersTable.id),
  title: varchar('title', {length: 255}),
  content: text('content'),
  pendingDeleteAt: timestamp('pending_deleted_at', {withTimezone: true}),
  updatedAt: timestamp('updated_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
  createdAt: timestamp('created_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
})

export type Note = InferModel<typeof NotesTable>
export type NewNote = Omit<
  InferModel<typeof NotesTable, 'insert'>,
  'id' | 'createdAt' | 'updatedAt'
>
export type UpdateNote = Omit<NewNote, 'authorId'>
