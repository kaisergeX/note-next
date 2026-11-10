import 'server-only'
import {randomUUID} from 'node:crypto'
import {and, desc, eq, isNull, sql} from 'drizzle-orm'
import type {PostgresJsDatabase} from 'drizzle-orm/postgres-js'
import {z} from 'zod'
import {noteVaultsTable as vaults} from '../schema/note-vaults'
import {
  notesTable as notes,
  noteCreationKeysTable as keys,
  themePgEnum,
} from '../schema/notes'
import {usersTable} from '../schema/users'
import {notePasskeysTable} from '../schema/note-passkeys'
import type {VaultWrapper} from '../../lib/notes/encryption/protocol'
import {
  canonicalIdSchema as id,
  encryptedNotePayloadSchema,
  vaultWrapperSchema,
} from '../../lib/notes/encryption/protocol'

export const setupVaultSchema = z.strictObject({
  setupId: id,
  vaultId: id,
  primaryWrapper: vaultWrapperSchema,
  recoveryWrapper: vaultWrapperSchema,
})
export const replacePrimarySchema = z.strictObject({
  operationId: id,
  expectedRevision: id,
  primaryWrapper: vaultWrapperSchema,
})
export const encryptedWriteSchema = z
  .strictObject({
    mode: z.literal('encrypted'),
    operation: z.enum(['create', 'save']),
    mutationId: id,
    expectedRevision: id.nullable(),
    payload: encryptedNotePayloadSchema,
    theme: z.enum(themePgEnum.enumValues).nullable(),
  })
  .refine((v) =>
    v.operation === 'create'
      ? v.expectedRevision === null
      : v.expectedRevision !== null,
  )
const same = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  const aa = Object.keys(a).sort(),
    bb = Object.keys(b).sort()
  return (
    aa.length === bb.length &&
    aa.every(
      (k, i) =>
        k === bb[i] &&
        same(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k],
        ),
    )
  )
}
export function createNoteEncryptionRepository(db: PostgresJsDatabase) {
  async function owned<T>(
    ownerId: string,
    run: (tx: PostgresJsDatabase) => Promise<T>,
  ) {
    return db.transaction(async (tx) => {
      const [owner] = await tx
        .select({id: usersTable.id})
        .from(usersTable)
        .where(eq(usersTable.id, ownerId))
        .for('update')
      return owner ? run(tx) : {status: 'unavailable' as const}
    })
  }
  async function getVault(ownerId: string, connection = db) {
    const [vault] = await connection
      .select()
      .from(vaults)
      .where(eq(vaults.ownerId, ownerId))
      .limit(1)
    return vault ?? null
  }
  async function verifiedPrimary(
    tx: PostgresJsDatabase,
    ownerId: string,
    wrapper: VaultWrapper,
  ) {
    if (wrapper.purpose !== 'passkey') return true
    if (!wrapper.passkeyBinding) return false
    const [credential] = await tx
      .select()
      .from(notePasskeysTable)
      .where(
        and(
          eq(notePasskeysTable.ownerId, ownerId),
          eq(notePasskeysTable.vaultId, wrapper.vaultId),
          eq(notePasskeysTable.credentialId, wrapper.passkeyBinding[1]),
          eq(notePasskeysTable.rpId, wrapper.passkeyBinding[0]),
          sql`${notePasskeysTable.verifiedAt} > now() - interval '10 minutes'`,
        ),
      )
      .limit(1)
    return Boolean(credential)
  }
  return {
    getVault,
    async setup(ownerId: string, input: unknown) {
      const parsed = setupVaultSchema.safeParse(input)
      if (!parsed.success) return {status: 'invalid_input'}
      const v = parsed.data
      if (
        v.primaryWrapper.ownerId !== ownerId ||
        v.recoveryWrapper.ownerId !== ownerId ||
        v.primaryWrapper.vaultId !== v.vaultId ||
        v.recoveryWrapper.vaultId !== v.vaultId ||
        v.recoveryWrapper.purpose !== 'recovery' ||
        v.primaryWrapper.purpose === 'recovery'
      )
        return {status: 'invalid_input'}
      return owned(ownerId, async (tx) => {
        const current = await getVault(ownerId, tx)
        if (current)
          return {
            status:
              current.setupId === v.setupId &&
              current.id === v.vaultId &&
              same(current.primaryWrapper, v.primaryWrapper) &&
              same(current.recoveryWrapper, v.recoveryWrapper)
                ? 'success'
                : 'conflict',
            vault: current,
          }
        if (!(await verifiedPrimary(tx, ownerId, v.primaryWrapper)))
          return {status: 'invalid_input'}
        if (process.env.NOTE_ENCRYPTION_ENROLLMENT_ENABLED !== 'true')
          return {status: 'disabled'}
        const [vault] = await tx
          .insert(vaults)
          .values({
            id: v.vaultId,
            ownerId,
            setupId: v.setupId,
            lastOperationId: v.setupId,
            primaryWrapper: v.primaryWrapper,
            recoveryWrapper: v.recoveryWrapper,
          })
          .returning()
        return {status: 'success', vault}
      })
    },
    async replacePrimary(ownerId: string, input: unknown) {
      const parsed = replacePrimarySchema.safeParse(input)
      if (!parsed.success) return {status: 'invalid_input'}
      const v = parsed.data
      if (
        v.primaryWrapper.ownerId !== ownerId ||
        v.primaryWrapper.purpose === 'recovery'
      )
        return {status: 'invalid_input'}
      return owned(ownerId, async (tx) => {
        const current = await getVault(ownerId, tx)
        if (!current) return {status: 'unavailable'}
        if (v.primaryWrapper.vaultId !== current.id)
          return {status: 'invalid_input'}
        if (
          current.lastOperationId === v.operationId &&
          same(current.primaryWrapper, v.primaryWrapper)
        )
          return {status: 'success', vault: current}
        if (!(await verifiedPrimary(tx, ownerId, v.primaryWrapper)))
          return {status: 'invalid_input'}
        if (
          current.revision !== v.expectedRevision ||
          current.lastOperationId === v.operationId
        )
          return {status: 'conflict', vault: current}
        const [vault] = await tx
          .update(vaults)
          .set({
            primaryWrapper: v.primaryWrapper,
            revision: randomUUID(),
            lastOperationId: v.operationId,
          })
          .where(
            and(
              eq(vaults.ownerId, ownerId),
              eq(vaults.revision, v.expectedRevision),
            ),
          )
          .returning()
        return {status: 'success', vault}
      })
    },
    async getNote(ownerId: string, noteId: string) {
      const [note] = await db
        .select()
        .from(notes)
        .where(
          and(
            eq(notes.authorId, ownerId),
            eq(notes.id, noteId),
            eq(notes.isEncrypted, true),
            sql`(${notes.pendingDeleteAt} IS NULL OR ${notes.pendingDeleteAt} > now())`,
          ),
        )
        .limit(1)
      return note ?? null
    },
    async headers(ownerId: string, before: string | null, trash: boolean) {
      return db
        .select({
          id: notes.id,
          vaultId: notes.vaultId,
          revision: notes.revision,
          theme: notes.theme,
          isArchived: notes.isArchived,
          createdAt: notes.createdAt,
          updatedAt: notes.updatedAt,
          pendingDeleteAt: notes.pendingDeleteAt,
          title: sql`encrypted_payload->'title'`,
          contentId: sql`encrypted_payload->>'contentId'`,
          deadlineToken: sql`to_char(pending_deleted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        })
        .from(notes)
        .where(
          and(
            eq(notes.authorId, ownerId),
            eq(notes.isEncrypted, true),
            trash
              ? sql`${notes.pendingDeleteAt} > now()`
              : isNull(notes.pendingDeleteAt),
            before ? sql`${notes.id} < ${before}::uuid` : undefined,
          ),
        )
        .orderBy(desc(notes.id))
        .limit(51)
    },
    async write(ownerId: string, noteId: string, input: unknown) {
      const parsed = encryptedWriteSchema.safeParse(input)
      if (!parsed.success || !id.safeParse(noteId).success)
        return {status: 'invalid_input'}
      const v = parsed.data
      if (v.payload.noteId !== noteId) return {status: 'invalid_input'}
      return owned(ownerId, async (tx) => {
        const vault = await getVault(ownerId, tx)
        if (!vault || vault.id !== v.payload.vaultId)
          return {status: 'invalid_input'}
        const [current] = await tx
          .select()
          .from(notes)
          .where(and(eq(notes.authorId, ownerId), eq(notes.id, noteId)))
          .limit(1)
        if (current?.pendingDeleteAt) return {status: 'unavailable'}
        const exact =
          current?.isEncrypted &&
          current.lastMutationId === v.mutationId &&
          same(current.encryptedPayload, v.payload) &&
          current.theme === v.theme
        if (exact) return {status: 'success', note: current}
        if (v.operation === 'create') {
          if (current) return {status: 'conflict', note: current}
          if (process.env.NOTE_ENCRYPTION_CREATION_ENABLED !== 'true')
            return {status: 'disabled'}
          const inserted = await tx
            .insert(keys)
            .values({id: noteId, authorId: ownerId})
            .onConflictDoNothing()
            .returning()
          if (!inserted.length) return {status: 'unavailable'}
          const [note] = await tx
            .insert(notes)
            .values({
              id: noteId,
              authorId: ownerId,
              title: null,
              content: null,
              isEncrypted: true,
              vaultId: vault.id,
              encryptedPayload: v.payload,
              lastMutationId: v.mutationId,
              theme: v.theme,
            })
            .returning()
          return {status: 'success', note}
        }
        if (!current || current.pendingDeleteAt) return {status: 'unavailable'}
        if (
          !current.isEncrypted ||
          current.revision !== v.expectedRevision ||
          current.lastMutationId === v.mutationId
        )
          return {status: 'conflict', note: current}
        const [note] = await tx
          .update(notes)
          .set({
            encryptedPayload: v.payload,
            lastMutationId: v.mutationId,
            theme: v.theme,
            revision: randomUUID(),
          })
          .where(
            and(
              eq(notes.authorId, ownerId),
              eq(notes.id, noteId),
              eq(notes.revision, v.expectedRevision!),
              eq(notes.isEncrypted, true),
              isNull(notes.pendingDeleteAt),
            ),
          )
          .returning()
        return note ? {status: 'success', note} : {status: 'unavailable'}
      })
    },
  }
}
