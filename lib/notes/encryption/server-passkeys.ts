import 'server-only'
import {randomUUID} from 'node:crypto'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type RegistrationResponseJSON,
  type AuthenticationResponseJSON,
} from '@simplewebauthn/server'
import {and, count, eq, gt, isNotNull, lte, sql} from 'drizzle-orm'
import {z} from 'zod'
import {db} from '~/db'
import {usersTable} from '~/db/schema/users'
import {noteVaultsTable} from '~/db/schema/note-vaults'
import {
  notePasskeysTable as credentials,
  notePasskeyChallengesTable as challenges,
} from '~/db/schema/note-passkeys'
import {
  canonicalIdSchema as id,
  encodeBase64url,
  decodeBase64url,
} from './protocol'
const MAX_OUTSTANDING = 8
const registration = z.strictObject({
  id: z.string().max(2048),
  rawId: z.string().max(2048),
  type: z.literal('public-key'),
  response: z.strictObject({
    clientDataJSON: z.string().max(16384),
    attestationObject: z.string().max(65536),
    transports: z.array(z.string().max(50)).max(10).optional(),
    publicKeyAlgorithm: z.number().optional(),
    publicKey: z.string().max(16384).optional(),
    authenticatorData: z.string().max(16384).optional(),
  }),
  clientExtensionResults: z.strictObject({}).default({}),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
})
const assertion = z.strictObject({
  id: z.string().max(2048),
  rawId: z.string().max(2048),
  type: z.literal('public-key'),
  response: z.strictObject({
    clientDataJSON: z.string().max(16384),
    authenticatorData: z.string().max(16384),
    signature: z.string().max(16384),
    userHandle: z.string().max(2048).optional(),
  }),
  clientExtensionResults: z.strictObject({}).default({}),
  authenticatorAttachment: z.enum(['platform', 'cross-platform']).optional(),
})
const schema = z.discriminatedUnion('operation', [
  z.strictObject({operation: z.literal('register-options'), vaultId: id}),
  z.strictObject({
    operation: z.literal('register-verify'),
    ceremonyId: id,
    response: registration,
  }),
  z.strictObject({
    operation: z.literal('assertion-options'),
    vaultId: id,
    credentialId: z.string().max(2048),
  }),
  z.strictObject({
    operation: z.literal('assertion-verify'),
    ceremonyId: id,
    response: assertion,
  }),
])
export async function passkeyCeremony(
  ownerId: string,
  origin: string,
  input: unknown,
) {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return {status: 'invalid_input'}
  const v = parsed.data
  // Configuration is authoritative; never infer relying-party trust from Host.
  if (!process.env.AUTH_URL || new URL(process.env.AUTH_URL).origin !== origin)
    return {status: 'unavailable'}
  const rpID = new URL(process.env.AUTH_URL).hostname
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({id: usersTable.id})
      .from(usersTable)
      .where(eq(usersTable.id, ownerId))
      .for('update')
    if (!user) return {status: 'unavailable'}
    if (
      v.operation === 'register-options' ||
      v.operation === 'register-verify'
    ) {
      const [vault] = await tx
        .select({
          id: noteVaultsTable.id,
          authorizationVersion: noteVaultsTable.authorizationVersion,
        })
        .from(noteVaultsTable)
        .where(eq(noteVaultsTable.ownerId, ownerId))
        .limit(1)
      if (vault) {
        if (vault.authorizationVersion !== 1) return {status: 'disabled'}
        if (v.operation === 'register-options' && v.vaultId !== vault.id)
          return {status: 'invalid_input'}
      } else if (process.env.NOTE_ENCRYPTION_ENROLLMENT_ENABLED !== 'true')
        return {status: 'disabled'}
    }
    await tx
      .delete(challenges)
      .where(
        and(
          eq(challenges.ownerId, ownerId),
          lte(challenges.expiresAt, sql`now()`),
        ),
      )
    await tx
      .delete(credentials)
      .where(
        and(
          eq(credentials.ownerId, ownerId),
          lte(credentials.provisionalExpiresAt, sql`now()`),
        ),
      )
    if (
      v.operation === 'register-options' ||
      v.operation === 'assertion-options'
    ) {
      const [outstanding] = await tx
        .select({total: count()})
        .from(challenges)
        .where(
          and(
            eq(challenges.ownerId, ownerId),
            eq(challenges.kind, v.operation),
          ),
        )
      if (outstanding.total >= MAX_OUTSTANDING) return {status: 'unavailable'}
      if (v.operation === 'register-options') {
        const [provisional] = await tx
          .select({total: count()})
          .from(credentials)
          .where(
            and(
              eq(credentials.ownerId, ownerId),
              isNotNull(credentials.provisionalExpiresAt),
            ),
          )
        // A registration reserves a slot until it is consumed or expires.
        if (outstanding.total + provisional.total >= MAX_OUTSTANDING)
          return {status: 'unavailable'}
      }
      if (v.operation === 'assertion-options') {
        const [credential] = await tx
          .select()
          .from(credentials)
          .where(
            and(
              eq(credentials.ownerId, ownerId),
              eq(credentials.credentialId, v.credentialId),
              eq(credentials.vaultId, v.vaultId),
              eq(credentials.rpId, rpID),
            ),
          )
        if (!credential) return {status: 'unavailable'}
      }
      const options =
        v.operation === 'register-options'
          ? await generateRegistrationOptions({
              rpName: 'Eton notes',
              rpID,
              userName: ownerId,
              // The generated per-registration handle lets a resident passkey
              // coexist with the current one on the same authenticator.
              authenticatorSelection: {
                residentKey: 'required',
                userVerification: 'required',
              },
              supportedAlgorithmIDs: [-7, -257],
              attestationType: 'none',
            })
          : await generateAuthenticationOptions({
              rpID,
              allowCredentials: [{id: v.credentialId}],
              userVerification: 'required',
            })
      const ceremonyId = randomUUID()
      await tx.insert(challenges).values({
        id: ceremonyId,
        ownerId,
        vaultId: v.vaultId,
        kind: v.operation,
        challenge: options.challenge,
        credentialId:
          v.operation === 'assertion-options' ? v.credentialId : null,
        origin,
        rpId: rpID,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      })
      return {status: 'success', ceremonyId, options}
    }
    const [challenge] = await tx
      .delete(challenges)
      .where(
        and(
          eq(challenges.id, v.ceremonyId),
          eq(challenges.ownerId, ownerId),
          eq(challenges.origin, origin),
          eq(challenges.rpId, rpID),
          eq(
            challenges.kind,
            v.operation === 'register-verify'
              ? 'register-options'
              : 'assertion-options',
          ),
          gt(challenges.expiresAt, sql`now()`),
        ),
      )
      .returning()
    if (!challenge) return {status: 'invalid_input'}
    if (v.operation === 'register-verify') {
      const [vault] = await tx
        .select({id: noteVaultsTable.id})
        .from(noteVaultsTable)
        .where(eq(noteVaultsTable.ownerId, ownerId))
        .limit(1)
      if (vault && vault.id !== challenge.vaultId)
        return {status: 'invalid_input'}
    }
    try {
      if (v.operation === 'register-verify') {
        const verified = await verifyRegistrationResponse({
          response: v.response as RegistrationResponseJSON,
          expectedChallenge: challenge.challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          requireUserVerification: true,
          supportedAlgorithmIDs: [-7, -257],
        })
        if (!verified.verified || !verified.registrationInfo)
          return {status: 'invalid_input'}
        const c = verified.registrationInfo.credential
        await tx
          .insert(credentials)
          .values({
            credentialId: c.id,
            ownerId,
            vaultId: challenge.vaultId,
            rpId: rpID,
            publicKey: encodeBase64url(c.publicKey),
            counter: c.counter,
            transports: c.transports ?? [],
            provisionalExpiresAt: sql`now() + interval '24 hours'`,
          })
          .onConflictDoNothing()
        return {status: 'success', credentialId: c.id}
      }
      if (challenge.credentialId !== v.response.id)
        return {status: 'invalid_input'}
      const [credential] = await tx
        .select()
        .from(credentials)
        .where(
          and(
            eq(credentials.ownerId, ownerId),
            eq(credentials.credentialId, v.response.id),
            eq(credentials.vaultId, challenge.vaultId),
          ),
        )
      if (!credential) return {status: 'invalid_input'}
      const verified = await verifyAuthenticationResponse({
        response: v.response as AuthenticationResponseJSON,
        expectedChallenge: challenge.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: {
          id: credential.credentialId,
          publicKey: decodeBase64url(credential.publicKey),
          counter: credential.counter,
        },
      })
      if (!verified.verified) return {status: 'invalid_input'}
      await tx
        .update(credentials)
        .set({
          counter: verified.authenticationInfo.newCounter,
          verifiedAt: new Date(),
        })
        .where(eq(credentials.credentialId, credential.credentialId))
      return {status: 'success', credentialId: credential.credentialId}
    } catch {
      return {status: 'invalid_input'}
    }
  })
}
