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
  gender: text('gender').notNull(),
  age: integer('age').notNull(),
  locale: varchar('locale', {length: 20}).notNull().default('vi-VN'),
  region: varchar('region', {length: 20}).notNull(),
  incomeBracket: varchar('income_bracket', {length: 100}).notNull(),
  occupation: varchar('occupation', {length: 100}).notNull(),
  backgroundTags: text('background_tags')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  personalitySliders: jsonb('personality_sliders')
    .$type<PersonalitySliders>()
    .notNull(),
  interviewStance: text('interview_stance').notNull(),
  quirksFreetext: text('quirks_freetext').notNull(),
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
