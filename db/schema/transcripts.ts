import {sql, type InferInsertModel, type InferSelectModel} from 'drizzle-orm'
import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import {personasTable} from './personas'

export type PersonalitySliders = {
  calm_anxious: number
  optimistic_cynical: number
  frugal_spendthrift: number
}

export type TranscriptTurn = {
  role: 'system' | 'user' | 'assistant'
  content: string
  timestamp: string
}

export const transcriptModePgEnum = pgEnum('transcript_mode', [
  'single',
  'group',
])

export const runStatusPgEnum = pgEnum('run_status', [
  'pending',
  'in_progress',
  'done',
  'failed',
])

export type TranscriptMode = (typeof transcriptModePgEnum.enumValues)[number]

export const runsTable = pgTable('runs', {
  id: uuid('id')
    .default(sql`generate_ulid()`)
    .primaryKey(),
  questionScript: text('question_script').array().notNull(),
  personaIds: uuid('persona_ids').array().notNull(),
  status: runStatusPgEnum('status').default('pending').notNull(),
  updatedAt: timestamp('updated_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
  createdAt: timestamp('created_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
})

export type Run = InferSelectModel<typeof runsTable>
export type NewRun = Omit<
  InferInsertModel<typeof runsTable>,
  'id' | 'createdAt' | 'updatedAt'
>
export type RunStatus = (typeof runsTable.$inferSelect.status)[number]

export const runItemStatusPgEnum = pgEnum('run_item_status', [
  'pending',
  'in_progress',
  'done',
  'failed',
])
export type RunItemStatus = (typeof runItemStatusPgEnum.enumValues)[number]

export const transcriptsTable = pgTable('transcripts', {
  id: uuid('id')
    .default(sql`generate_ulid()`)
    .primaryKey(),
  personaId: uuid('persona_id')
    .notNull()
    .references(() => personasTable.id),
  runId: uuid('run_id').references(() => runsTable.id),
  mode: transcriptModePgEnum('mode').notNull(),
  turns: jsonb('turns')
    .$type<TranscriptTurn[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  model: varchar('model', {length: 200}).notNull(),
  systemPrompt: text('system_prompt').notNull(),
  createdAt: timestamp('created_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
})

export type Transcript = InferSelectModel<typeof transcriptsTable>
export type NewTranscript = Omit<
  InferInsertModel<typeof transcriptsTable>,
  'id' | 'createdAt'
>

export const runItemsTable = pgTable(
  'run_items',
  {
    id: uuid('id')
      .default(sql`generate_ulid()`)
      .primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => runsTable.id),
    personaId: uuid('persona_id')
      .notNull()
      .references(() => personasTable.id),
    status: runItemStatusPgEnum('status').default('pending').notNull(),
    error: text('error'),
  },
  (t) => [unique('run_items_run_persona_unique').on(t.runId, t.personaId)],
)

export type RunItem = InferSelectModel<typeof runItemsTable>
export type NewRunItem = Omit<
  InferInsertModel<typeof runItemsTable>,
  'id' | 'createdAt' | 'updatedAt'
>
