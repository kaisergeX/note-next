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
    const commitment = await setupRootCommitment(root, {
      ownerId,
      vaultId,
      setupId,
      primary: primaryWrapper,
      recovery: recoveryWrapper,
    })
    return {
      candidate: {
        ownerId,
        vaultId,
        setupId,
        primaryWrapper,
        recoveryWrapper,
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
