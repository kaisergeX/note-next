import {
  foreignKey,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import {noteVaultsTable} from './note-vaults'

// Accepted operations remain reconcilable until their vault is deleted.
export const noteVaultOperationReceiptsTable = pgTable(
  'note_vault_operation_receipts',
  {
    vaultId: uuid('vault_id').notNull(),
    ownerId: uuid('owner_id').notNull(),
    operationId: uuid('operation_id').notNull(),
    intentDigest: text('intent_digest').notNull(),
    appliedRevision: uuid('applied_revision').notNull(),
    createdAt: timestamp('created_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({columns: [table.vaultId, table.operationId]}),
    foreignKey({
      columns: [table.vaultId, table.ownerId],
      foreignColumns: [noteVaultsTable.id, noteVaultsTable.ownerId],
      name: 'note_vault_operation_receipts_vault_owner_fk',
    }).onDelete('cascade'),
  ],
)
