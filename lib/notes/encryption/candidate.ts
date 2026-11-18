import {
  decodeRecoveryKey,
  encodeRecoveryKey,
  generatePassphrase,
  generatePassphraseSalt,
  generateRoot,
  setupRootCommitment,
  unwrapRoot,
  wrapRoot,
} from './crypto'
import {
  authorizationSchema,
  createAuthorization,
  openAuthorizationSigner,
  signReplacement,
  type VaultAuthorization,
} from './authorization'
import type {VaultWrapper} from './protocol'
import {enrollPasskey} from './passkey'
import {z} from 'zod'
import {canonicalIdSchema, vaultWrapperSchema} from './protocol'
export const vaultCandidateSchema = z.strictObject({
  ownerId: canonicalIdSchema,
  vaultId: canonicalIdSchema,
  setupId: canonicalIdSchema,
  primaryWrapper: vaultWrapperSchema,
  recoveryWrapper: vaultWrapperSchema,
  authorization: authorizationSchema.optional(),
  commitment: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  primaryChecked: z.boolean(),
  recoveryChecked: z.boolean(),
  submitted: z.boolean(),
})
export type VaultCandidate = {
  ownerId: string
  vaultId: string
  setupId: string
  primaryWrapper: VaultWrapper
  recoveryWrapper: VaultWrapper
  authorization?: VaultAuthorization
  commitment: string
  primaryChecked: boolean
  recoveryChecked: boolean
  submitted: boolean
}
export async function createVaultCandidate(
  ownerId: string,
  method: 'passphrase' | 'passkey' = 'passphrase',
) {
  const vaultId = crypto.randomUUID()
  const passkey = method === 'passkey' ? await enrollPasskey(vaultId) : null
  const root = generateRoot(),
    recovery = generateRoot(),
    passphrase = generatePassphrase()
  try {
    const setupId = crypto.randomUUID()
    const primaryWrapper = await wrapRoot(
      root,
      {
        ownerId,
        vaultId,
        wrapperId: crypto.randomUUID(),
        purpose: method,
        profileId: passkey
          ? 'webauthn-prf-hkdf-sha256'
          : 'pbkdf2-sha256-600000',
        salt: passkey ? null : generatePassphraseSalt(),
        passkeyBinding: passkey?.binding ?? null,
      },
      passkey?.output ?? passphrase,
    )
    const recoveryWrapper = await wrapRoot(
      root,
      {
        ownerId,
        vaultId,
        wrapperId: crypto.randomUUID(),
        purpose: 'recovery',
        profileId: null,
        salt: null,
        passkeyBinding: null,
      },
      recovery,
    )
    const authorization = await createAuthorization(
      root,
      ownerId,
      vaultId,
      setupId,
    )
    const commitment = await setupRootCommitment(root, {
      ownerId,
      vaultId,
      setupId,
      primary: primaryWrapper,
      recovery: recoveryWrapper,
      authorization,
    })
    return {
      candidate: {
        ownerId,
        vaultId,
        setupId,
        primaryWrapper,
        recoveryWrapper,
        authorization,
        commitment,
        primaryChecked: false,
        recoveryChecked: false,
        submitted: false,
      } satisfies VaultCandidate,
      passphrase: passkey ? '' : passphrase,
      recoveryKit: await encodeRecoveryKey(recovery),
    }
  } finally {
    root.fill(0)
    recovery.fill(0)
    passkey?.output.fill(0)
  }
}
export async function verifyCandidate(
  candidate: VaultCandidate,
  purpose: 'primary' | 'recovery',
  secret: string | Uint8Array,
) {
  const recovery =
    purpose === 'recovery' && typeof secret === 'string'
      ? await decodeRecoveryKey(secret)
      : null
  let root: Uint8Array | null = null
  try {
    root = await unwrapRoot(
      purpose === 'primary'
        ? candidate.primaryWrapper
        : candidate.recoveryWrapper,
      recovery ?? secret,
    )
    const actual = await setupRootCommitment(root, {
      ownerId: candidate.ownerId,
      vaultId: candidate.vaultId,
      setupId: candidate.setupId,
      primary: candidate.primaryWrapper,
      recovery: candidate.recoveryWrapper,
      ...(candidate.authorization
        ? {authorization: candidate.authorization}
        : {}),
    })
    if (actual !== candidate.commitment) throw new Error('Candidate mismatch')
    return {
      ...candidate,
      ...(purpose === 'primary'
        ? {primaryChecked: true}
        : {recoveryChecked: true}),
    }
  } finally {
    root?.fill(0)
    recovery?.fill(0)
  }
}

export type ReplacementCandidate = {
  ownerId: string
  vaultId: string
  setupId: string
  expectedRevision: string
  operationId: string
  authorization: VaultAuthorization
  primaryWrapper: VaultWrapper
}
export async function createReplacementCandidate(
  raw: Uint8Array,
  vault: {
    ownerId: string
    id: string
    setupId: string
    revision: string
    authorization: VaultAuthorization
  },
  method: 'passphrase' | 'passkey',
  assertCurrent: () => void = () => {},
) {
  await openAuthorizationSigner(
    raw,
    vault.ownerId,
    vault.id,
    vault.setupId,
    vault.authorization,
  )
  assertCurrent()
  const passkey = method === 'passkey' ? await enrollPasskey(vault.id) : null
  const phrase = passkey ? '' : generatePassphrase()
  try {
    const primaryWrapper = await wrapRoot(
      raw,
      {
        ownerId: vault.ownerId,
        vaultId: vault.id,
        wrapperId: crypto.randomUUID(),
        purpose: method,
        profileId: passkey
          ? 'webauthn-prf-hkdf-sha256'
          : 'pbkdf2-sha256-600000',
        salt: passkey ? null : generatePassphraseSalt(),
        passkeyBinding: passkey?.binding ?? null,
      },
      passkey?.output ?? phrase,
    )
    return {
      candidate: {
        ownerId: vault.ownerId,
        vaultId: vault.id,
        setupId: vault.setupId,
        expectedRevision: vault.revision,
        operationId: crypto.randomUUID(),
        authorization: vault.authorization,
        primaryWrapper,
      } satisfies ReplacementCandidate,
      passphrase: phrase,
    }
  } finally {
    passkey?.output.fill(0)
  }
}
export async function confirmReplacement(
  candidate: ReplacementCandidate,
  secret: string | Uint8Array,
) {
  const raw = await unwrapRoot(candidate.primaryWrapper, secret)
  try {
    const signer = await openAuthorizationSigner(
      raw,
      candidate.ownerId,
      candidate.vaultId,
      candidate.setupId,
      candidate.authorization,
    )
    return await signReplacement(signer, {
      ownerId: candidate.ownerId,
      vaultId: candidate.vaultId,
      verifierId: candidate.authorization.verifierId,
      expectedRevision: candidate.expectedRevision,
      operationId: candidate.operationId,
      primaryWrapper: candidate.primaryWrapper,
    })
  } finally {
    raw.fill(0)
  }
}
