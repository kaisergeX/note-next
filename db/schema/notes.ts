/**
 * Import paths must not use alias, otherwise it will cause error.
 */

import {sql, type InferInsertModel, type InferSelectModel} from 'drizzle-orm'
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import {usersTable} from './users'

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

export const notesTable = pgTable(
  'notes',
  {
    id: uuid('id')
      .default(sql`generate_ulid()`)
      .primaryKey(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => usersTable.id),
    revision: uuid('revision').defaultRandom().notNull(),
    lastMutationId: uuid('last_mutation_id'),
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
  },
  (table) => [
    index('notes_owner_trash_deadline_idx')
      .on(table.authorId, table.pendingDeleteAt.desc(), table.id.desc())
      .where(sql`${table.pendingDeleteAt} IS NOT NULL`),
    index('notes_expiry_deadline_idx')
      .on(table.pendingDeleteAt, table.id)
      .where(sql`${table.pendingDeleteAt} IS NOT NULL`),
  ],
)

export type Note = InferSelectModel<typeof notesTable>
export type NewNote = Omit<
  InferInsertModel<typeof notesTable>,
  'id' | 'createdAt' | 'updatedAt'
>
export type UpdateNote = Omit<NewNote, 'authorId'>
export type DisallowedUpdateNoteKeys = Exclude<keyof Note, keyof UpdateNote>

// Creation identities survive permanent note deletion, preventing a lost-response
// retry from resurrecting an original. No note content or history is retained.
export const noteCreationKeysTable = pgTable('note_creation_keys', {
  id: uuid('id').primaryKey(),
  authorId: uuid('author_id')
    .notNull()
    .references(() => usersTable.id, {onDelete: 'cascade'}),
})
