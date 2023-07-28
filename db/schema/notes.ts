/**
 * Import paths must not use alias, otherwise it will cause error.
 */

import {sql, type InferModel} from 'drizzle-orm'
import {
  pgTable,
  varchar,
  text,
  timestamp,
  uuid,
  pgEnum,
  boolean,
} from 'drizzle-orm/pg-core'
import {UsersTable} from './users'

export const NOTE_TITLE_MAX_LENGTH = 255

export const themePgEnum = pgEnum('theme', [
  'encrypted',
  'slate',
  'zinc',
  'stone',
  'red',
  'orange',
  'yellow',
  'green',
  'cyan',
  'blue',
  'purple',
  'pink',
  'rose',
])

export type NoteTheme = (typeof themePgEnum.enumValues)[number]

export const NotesTable = pgTable('notes', {
  id: uuid('id')
    .default(sql`generate_ulid()`)
    .primaryKey(),
  authorId: uuid('author_id')
    .notNull()
    .references(() => UsersTable.id),
  // 255 * 3 | content max length is 255, assuming that html tags are twice the length of the content
  title: varchar('title', {length: NOTE_TITLE_MAX_LENGTH * 3}),
  content: text('content'),

  theme: themePgEnum('theme'),
  // tags: array
  isEncrypted: boolean('is_encrypted').default(false).notNull(),
  isArchived: boolean('is_archived').default(false).notNull(),

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
