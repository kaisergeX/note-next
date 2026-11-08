// Schema imports must remain relative for Drizzle Kit.
import {index, pgTable, text, uuid} from 'drizzle-orm/pg-core'
import {notesTable} from './notes'

export const noteSearchDocumentsTable = pgTable(
  'note_search_documents',
  {
    noteId: uuid('note_id')
      .primaryKey()
      .references(() => notesTable.id, {onDelete: 'cascade'}),
    titleText: text('title_text').notNull(),
    bodyText: text('body_text'),
    titleFold: text('title_fold').notNull(),
    bodyFold: text('body_fold'),
  },
  (table) => [
    index('note_search_title_trgm_idx').using(
      'gin',
      table.titleFold.op('gin_trgm_ops'),
    ),
    index('note_search_body_trgm_idx').using(
      'gin',
      table.bodyFold.op('gin_trgm_ops'),
    ),
  ],
)
