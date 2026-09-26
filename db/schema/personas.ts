import {sql, type InferInsertModel, type InferSelectModel} from 'drizzle-orm'
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import type {PersonalitySliders} from './transcripts'

export const personaStatusPgEnum = pgEnum('persona_status', [
  'draft',
  'active',
  'archived',
])
export type PersonaStatus = (typeof personaStatusPgEnum.enumValues)[number]

export const personasTable = pgTable('personas', {
  id: uuid('id')
    .default(sql`generate_ulid()`)
    .primaryKey(),
  name: varchar('name', {length: 100}).notNull(),
  // Nullable since the Phase-3 UX follow-up: relaxed save requires only
  // name + region; drafts may leave these for the LLM to invent.
  gender: text('gender'),
  age: integer('age'),
  locale: varchar('locale', {length: 20}).notNull().default('vi-VN'),
  region: varchar('region', {length: 50}).notNull(),
  incomeBracket: varchar('income_bracket', {length: 100}),
  occupation: varchar('occupation', {length: 100}),
  backgroundTags: text('background_tags')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  personalitySliders: jsonb('personality_sliders')
    .$type<PersonalitySliders>()
    .notNull(),
  interviewStance: text('interview_stance'),
  quirksFreetext: text('quirks_freetext'),
  generatedBio: text('generated_bio'),
  systemPrompt: text('system_prompt'),
  status: personaStatusPgEnum('status').default('draft').notNull(),
  updatedAt: timestamp('updated_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
  createdAt: timestamp('created_at', {withTimezone: true})
    .defaultNow()
    .notNull(),
})

export type Persona = InferSelectModel<typeof personasTable>
export type NewPersona = Omit<
  InferInsertModel<typeof personasTable>,
  'id' | 'createdAt' | 'updatedAt'
>
