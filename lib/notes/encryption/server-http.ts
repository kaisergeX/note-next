import {readEncryptionBody} from './read-body'
import 'server-only'
import {NextResponse, type NextRequest} from 'next/server'
import {auth} from '~/auth'
import {db} from '~/db'
import {createNoteEncryptionRepository} from '~/db/repositories/note-encryption'
export const encryptionRepository = createNoteEncryptionRepository(db)
export const encryptionReply = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: {'Cache-Control': 'private, no-store'},
  })
export async function encryptionAuth(request: NextRequest, mutate = false) {
  if (mutate && request.headers.get('origin') !== request.nextUrl.origin)
    return {error: encryptionReply({status: 'invalid_input'}, 403)}
  const session = await auth()
  if (!session?.user?.id || session.error)
    return {error: encryptionReply({status: 'unauthenticated'}, 401)}
  if (mutate && request.headers.get('x-note-encryption-protocol') !== '1')
    return {error: encryptionReply({status: 'reload_required'}, 426)}
  return {ownerId: session.user.id}
}
export async function encryptedMutation(
  request: NextRequest,
  run: (ownerId: string, input: unknown) => Promise<unknown>,
  limit?: number,
) {
  const access = await encryptionAuth(request, true)
  if (access.error) return access.error
  try {
    return encryptionReply(
      await run(access.ownerId!, await readEncryptionBody(request, limit)),
    )
  } catch (error) {
    return encryptionReply(
      {
        status:
          error instanceof RangeError ||
          error instanceof SyntaxError ||
          error instanceof TypeError
            ? 'invalid_input'
            : 'retryable_error',
      },
      error instanceof RangeError
        ? 413
        : error instanceof SyntaxError || error instanceof TypeError
          ? 400
          : 503,
    )
  }
}
