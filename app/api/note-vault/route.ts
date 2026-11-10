import type {NextRequest} from 'next/server'
import {
  encryptionAuth,
  encryptionReply,
  encryptionRepository,
  encryptedMutation,
} from '~/lib/notes/encryption/server-http'
export async function GET(request: NextRequest) {
  const access = await encryptionAuth(request)
  if (access.error) return access.error
  try {
    return encryptionReply({
      status: 'success',
      vault: await encryptionRepository.getVault(access.ownerId!),
    })
  } catch {
    return encryptionReply({status: 'retryable_error'}, 503)
  }
}
export const POST = (request: NextRequest) =>
  encryptedMutation(
    request,
    (owner, input) => encryptionRepository.setup(owner, input),
    16384,
  )
export const PATCH = (request: NextRequest) =>
  encryptedMutation(
    request,
    (owner, input) => encryptionRepository.replacePrimary(owner, input),
    16384,
  )
