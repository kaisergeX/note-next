import {
  bigint,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import {usersTable} from './users'
export const notePasskeysTable = pgTable('note_passkeys', {
  credentialId: text('credential_id').primaryKey(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => usersTable.id, {onDelete: 'cascade'}),
  vaultId: uuid('vault_id').notNull(),
  rpId: text('rp_id').notNull(),
  publicKey: text('public_key').notNull(),
  counter: bigint('counter', {mode: 'number'}).notNull(),
  transports: jsonb('transports').$type<string[]>().notNull(),
  verifiedAt: timestamp('verified_at', {withTimezone: true}),
})
export const notePasskeyChallengesTable = pgTable('note_passkey_challenges', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => usersTable.id, {onDelete: 'cascade'}),
  vaultId: uuid('vault_id').notNull(),
  credentialId: text('credential_id'),
  kind: text('kind').notNull(),
  challenge: text('challenge').notNull(),
  origin: text('origin').notNull(),
  rpId: text('rp_id').notNull(),
  expiresAt: timestamp('expires_at', {withTimezone: true}).notNull(),
})
