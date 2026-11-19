import 'server-only'
import {randomUUID} from 'node:crypto'
import {and, desc, eq, gt, isNull, or, sql} from 'drizzle-orm'
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
import {noteVaultOperationReceiptsTable as receipts} from '../schema/note-vault-operation-receipts'
import {
  authorizationSchema,
  signedReplacementSchema,
  validateAuthorization,
  verifyReplacement,
  replacementIntentDigest,
} from '../../lib/notes/encryption/authorization'
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
  authorizationVersion: z.literal(1).optional(),
  authorization: authorizationSchema.optional(),
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
  function primaryPasskey(ownerId: string, wrapper: VaultWrapper) {
    const binding = wrapper.passkeyBinding
    if (!binding) throw new Error('Missing passkey binding')
    return and(
      eq(notePasskeysTable.ownerId, ownerId),
      eq(notePasskeysTable.vaultId, wrapper.vaultId),
      eq(notePasskeysTable.credentialId, binding[1]),
      eq(notePasskeysTable.rpId, binding[0]),
    )
  }
  async function retainPrimary(
    tx: PostgresJsDatabase,
    ownerId: string,
    wrapper: VaultWrapper,
  ) {
    if (wrapper.purpose === 'passkey')
      await tx
        .update(notePasskeysTable)
        .set({provisionalExpiresAt: null})
        .where(primaryPasskey(ownerId, wrapper))
  }
  async function checkPrimary(
    tx: PostgresJsDatabase,
    ownerId: string,
    wrapper: VaultWrapper,
  ) {
    if (wrapper.purpose !== 'passkey') return 'verified'
    const [credential] = await tx
      .select({
        recent: sql<boolean>`${notePasskeysTable.verifiedAt} > now() - interval '10 minutes'`,
      })
      .from(notePasskeysTable)
      .where(
        and(
          primaryPasskey(ownerId, wrapper),
          or(
            isNull(notePasskeysTable.provisionalExpiresAt),
            gt(notePasskeysTable.provisionalExpiresAt, sql`now()`),
          ),
        ),
      )
      .limit(1)
    return !credential
      ? 'passkey_unavailable'
      : credential.recent
        ? 'verified'
        : 'passkey_assertion_required'
  }
  return {
    getVault,
    async getOperation(ownerId: string, operationId: string) {
      return owned(ownerId, async (tx) => {
        const vault = await getVault(ownerId, tx)
        const [receipt] = vault
          ? await tx
              .select({
                operationId: receipts.operationId,
                intentDigest: receipts.intentDigest,
                appliedRevision: receipts.appliedRevision,
              })
              .from(receipts)
              .where(
                and(
                  eq(receipts.vaultId, vault.id),
                  eq(receipts.operationId, operationId),
                ),
              )
              .limit(1)
          : []
        return {status: 'success', vault, receipt: receipt ?? null}
      })
    },
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
              same(current.recoveryWrapper, v.recoveryWrapper) &&
              current.authorizationVersion === (v.authorizationVersion ?? 0) &&
              same(current.authorization, v.authorization ?? null)
                ? 'success'
                : 'conflict',
            vault: current,
          }
        if (v.authorizationVersion !== 1 || !v.authorization)
          return {status: 'reload_required'}
        try {
          await validateAuthorization(v.authorization)
        } catch {
          return {status: 'invalid_input'}
        }
        const primary = await checkPrimary(tx, ownerId, v.primaryWrapper)
        if (primary !== 'verified') return {status: primary}
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
            authorizationVersion: 1,
            authorization: v.authorization,
          })
          .returning()
        await retainPrimary(tx, ownerId, v.primaryWrapper)
        return {status: 'success', vault}
      })
    },
    async replacePrimary(ownerId: string, input: unknown) {
      const parsed = signedReplacementSchema.safeParse(input)
      if (!parsed.success || parsed.data.ownerId !== ownerId)
        return {status: 'invalid_input'}
      const v = parsed.data
      return owned(ownerId, async (tx) => {
        const vault = await getVault(ownerId, tx)
        if (!vault || vault.id !== v.vaultId) return {status: 'unavailable'}
        if (vault.authorizationVersion !== 1 || !vault.authorization)
          return {status: 'disabled'}
        let authorization
        try {
          authorization = await validateAuthorization(vault.authorization)
          if (
            authorization.verifierId !== v.verifierId ||
            !(await verifyReplacement(authorization, v))
          )
            return {status: 'invalid_input'}
        } catch {
          return {status: 'invalid_input'}
        }
        const {signature: _signature, ...intent} = v
        const intentDigest = await replacementIntentDigest(intent)
        const [accepted] = await tx
          .select({
            operationId: receipts.operationId,
            intentDigest: receipts.intentDigest,
            appliedRevision: receipts.appliedRevision,
          })
          .from(receipts)
          .where(
            and(
              eq(receipts.vaultId, vault.id),
              eq(receipts.operationId, v.operationId),
            ),
          )
          .limit(1)
        if (accepted)
          return accepted.intentDigest === intentDigest
            ? {
                status: 'success',
                vault,
                receipt: accepted,
                alreadyApplied: true,
              }
            : {status: 'conflict', vault}
        if (
          vault.revision !== v.expectedRevision ||
          vault.lastOperationId === v.operationId
        )
          return {status: 'conflict', vault}
        const primary = await checkPrimary(tx, ownerId, v.primaryWrapper)
        if (primary !== 'verified') return {status: primary}
        const appliedRevision = randomUUID()
        const [updated] = await tx
          .update(vaults)
          .set({
            primaryWrapper: v.primaryWrapper,
            revision: appliedRevision,
            lastOperationId: v.operationId,
          })
          .where(
            and(
              eq(vaults.id, vault.id),
              eq(vaults.ownerId, ownerId),
              eq(vaults.revision, v.expectedRevision),
            ),
          )
          .returning()
        if (!updated) return {status: 'conflict', vault}
        await retainPrimary(tx, ownerId, v.primaryWrapper)
        const receipt = {
          operationId: v.operationId,
          intentDigest,
          appliedRevision,
        }
        await tx
          .insert(receipts)
          .values({...receipt, vaultId: vault.id, ownerId})
        return {
          status: 'success',
          vault: updated,
          receipt,
          alreadyApplied: false,
        }
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
