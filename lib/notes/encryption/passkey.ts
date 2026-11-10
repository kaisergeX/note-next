import {decodeBase64url, encodeBase64url, type VaultWrapper} from './protocol'
type OptionsJSON = Record<string, unknown>
async function ceremony(body: unknown) {
  const response = await fetch('/api/note-vault/passkey', {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'x-note-encryption-protocol': '1',
    },
    body: JSON.stringify(body),
  })
  const data = (await response.json()) as {
    status: string
    ceremonyId: string
    options: OptionsJSON
    credentialId?: string
  }
  if (data.status !== 'success') throw new Error('Passkey ceremony failed')
  return data
}
function descriptors(input: unknown) {
  return (
    input as
      | {
          id: string
          type: 'public-key'
          transports?: AuthenticatorTransport[]
        }[]
      | undefined
  )?.map((value) => ({...value, id: decodeBase64url(value.id)}))
}
function prf(credential: PublicKeyCredential) {
  const result =
    credential.getClientExtensionResults() as AuthenticationExtensionsClientOutputs & {
      prf?: {results?: {first?: ArrayBuffer}}
    }
  const first = result.prf?.results?.first
  if (!first || first.byteLength !== 32) throw new Error('PRF unavailable')
  return new Uint8Array(first)
}
const encoded = (value: ArrayBuffer) => encodeBase64url(new Uint8Array(value))
export async function assertPasskey(
  vaultId: string,
  binding: NonNullable<VaultWrapper['passkeyBinding']>,
) {
  const [rpId, credentialId, input] = binding
  const data = await ceremony({
    operation: 'assertion-options',
    vaultId,
    credentialId,
  })
  if (data.options.rpId !== rpId) throw new Error('Relying party mismatch')
  const publicKey = {
    ...data.options,
    challenge: decodeBase64url(data.options.challenge as string),
    rpId,
    userVerification: 'required',
    allowCredentials: [{id: decodeBase64url(credentialId), type: 'public-key'}],
    extensions: {prf: {eval: {first: decodeBase64url(input)}}},
  } as PublicKeyCredentialRequestOptions
  const credential = (await navigator.credentials.get({
    publicKey,
  })) as PublicKeyCredential | null
  if (!credential || encoded(credential.rawId) !== credentialId)
    throw new Error('Credential mismatch')
  const output = prf(credential)
  try {
    const response = credential.response as AuthenticatorAssertionResponse
    await ceremony({
      operation: 'assertion-verify',
      ceremonyId: data.ceremonyId,
      response: {
        id: credential.id,
        rawId: encoded(credential.rawId),
        type: 'public-key',
        authenticatorAttachment:
          credential.authenticatorAttachment ?? undefined,
        clientExtensionResults: {},
        response: {
          clientDataJSON: encoded(response.clientDataJSON),
          authenticatorData: encoded(response.authenticatorData),
          signature: encoded(response.signature),
          userHandle: response.userHandle
            ? encoded(response.userHandle)
            : undefined,
        },
      },
    })
    return output
  } catch (error) {
    output.fill(0)
    throw error
  }
}
export async function enrollPasskey(vaultId: string) {
  if (!window.PublicKeyCredential) throw new Error('Passkeys unavailable')
  const input = crypto.getRandomValues(new Uint8Array(32))
  const data = await ceremony({operation: 'register-options', vaultId})
  const user = data.options.user as {
    id: string
    name: string
    displayName: string
  }
  const rp = data.options.rp as PublicKeyCredentialRpEntity
  if (!rp.id) throw new Error('Missing relying party')
  const publicKey = {
    ...data.options,
    rp,
    pubKeyCredParams: data.options
      .pubKeyCredParams as PublicKeyCredentialParameters[],
    challenge: decodeBase64url(data.options.challenge as string),
    user: {...user, id: decodeBase64url(user.id)},
    excludeCredentials: descriptors(data.options.excludeCredentials),
    authenticatorSelection: {
      ...(data.options.authenticatorSelection as object),
      userVerification: 'required',
    },
    extensions: {prf: {eval: {first: input}}},
  } as PublicKeyCredentialCreationOptions
  const credential = (await navigator.credentials.create({
    publicKey,
  })) as PublicKeyCredential | null
  if (!credential) throw new Error('Enrollment cancelled')
  const response = credential.response as AuthenticatorAttestationResponse
  await ceremony({
    operation: 'register-verify',
    ceremonyId: data.ceremonyId,
    response: {
      id: credential.id,
      rawId: encoded(credential.rawId),
      type: 'public-key',
      authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
      clientExtensionResults: {},
      response: {
        clientDataJSON: encoded(response.clientDataJSON),
        attestationObject: encoded(response.attestationObject),
        transports: response.getTransports(),
      },
    },
  })
  const binding: [string, string, string] = [
    rp.id,
    encoded(credential.rawId),
    encodeBase64url(input),
  ]
  // A separate assertion must actually return PRF output before setup can proceed.
  return {binding, output: await assertPasskey(vaultId, binding)}
}
