import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import {usersTable} from './users'
export const notePasskeysTable = pgTable(
  'note_passkeys',
  {
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
    provisionalExpiresAt: timestamp('provisional_expires_at', {
      withTimezone: true,
    }),
  },
  (table) => [
    index('note_passkeys_owner_expiry_idx').on(
      table.ownerId,
      table.provisionalExpiresAt,
    ),
  ],
)
export const notePasskeyChallengesTable = pgTable(
  'note_passkey_challenges',
  {
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
  },
  (table) => [
    index('note_passkey_challenges_owner_kind_idx').on(
      table.ownerId,
      table.kind,
    ),
  ],
)
