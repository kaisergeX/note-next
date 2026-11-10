import type {NextRequest} from 'next/server'
import {canonicalIdSchema} from '~/lib/notes/encryption/protocol'
import {
  encryptionAuth,
  encryptionReply,
  encryptionRepository,
  encryptedMutation,
} from '~/lib/notes/encryption/server-http'
type Context = {params: Promise<{id: string}>}
export async function GET(request: NextRequest, context: Context) {
  const access = await encryptionAuth(request)
  if (access.error) return access.error
  const {id} = await context.params
  if (!canonicalIdSchema.safeParse(id).success)
    return encryptionReply({status: 'invalid_input'}, 400)
  try {
    const note = await encryptionRepository.getNote(access.ownerId!, id)
    return encryptionReply(
      note ? {status: 'success', note} : {status: 'unavailable'},
    )
  } catch {
    return encryptionReply({status: 'retryable_error'}, 503)
  }
}
export async function PUT(request: NextRequest, context: Context) {
  const {id} = await context.params
  return encryptedMutation(request, (owner, input) =>
    encryptionRepository.write(owner, id, input),
  )
}
