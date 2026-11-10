import type {NextRequest} from 'next/server'
import {canonicalIdSchema} from '~/lib/notes/encryption/protocol'
import {
  encryptionAuth,
  encryptionReply,
  encryptionRepository,
} from '~/lib/notes/encryption/server-http'
export async function GET(request: NextRequest) {
  const access = await encryptionAuth(request)
  if (access.error) return access.error
  const before = request.nextUrl.searchParams.get('before')
  if (before && !canonicalIdSchema.safeParse(before).success)
    return encryptionReply({status: 'invalid_input'}, 400)
  try {
    const rows = await encryptionRepository.headers(
      access.ownerId!,
      before,
      request.nextUrl.searchParams.get('trash') === 'true',
    )
    return encryptionReply({
      status: 'success',
      notes: rows.slice(0, 50),
      nextCursor: rows.length > 50 ? rows[49].id : null,
    })
  } catch {
    return encryptionReply({status: 'retryable_error'}, 503)
  }
}
