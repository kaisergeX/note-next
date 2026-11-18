import type {NextRequest} from 'next/server'
import {
  encryptionAuth,
  encryptionReply,
  encryptionRepository,
  encryptedMutation,
} from '~/lib/notes/encryption/server-http'
import {canonicalIdSchema} from '~/lib/notes/encryption/protocol'
export async function GET(request: NextRequest) {
  const access = await encryptionAuth(request)
  if (access.error) return access.error
  const operationId = request.nextUrl.searchParams.get('operationId')
  if (
    [...request.nextUrl.searchParams.keys()].some(
      (key) => key !== 'operationId',
    ) ||
    request.nextUrl.searchParams.getAll('operationId').length > 1 ||
    (operationId !== null && !canonicalIdSchema.safeParse(operationId).success)
  )
    return encryptionReply({status: 'invalid_input'}, 400)
  try {
    if (operationId)
      return encryptionReply(
        await encryptionRepository.getOperation(access.ownerId!, operationId),
      )
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
