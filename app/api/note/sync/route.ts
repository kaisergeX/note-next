import {type NextRequest, NextResponse} from 'next/server'
import {auth} from '~/auth'
import {accountRepository} from '~/db/helper/account'
import {getNoteMutationCacheKeys} from '~/db/helper'
import {revalidateTag} from 'next/cache'
import type {SyncResult} from '~/lib/notes/sync'
import {readSyncBody, SYNC_BODY_BYTE_LIMIT} from '~/lib/notes/read-sync-body'

export async function POST(request: NextRequest) {
  const reply = (result: SyncResult, status = 200) =>
    NextResponse.json(result, {
      status,
      headers: {'Cache-Control': 'private, no-store'},
    })
  if (request.headers.get('origin') !== request.nextUrl.origin)
    return reply({status: 'invalid_input'}, 403)
  const session = await auth()
  if (!session?.user?.id || session.error)
    return reply({status: 'unauthenticated'}, 401)
  // Bound the wire payload before parsing; never echo exceptions/SQL parameters.
  if (Number(request.headers.get('content-length')) > SYNC_BODY_BYTE_LIMIT)
    return reply({status: 'invalid_input'}, 413)
  try {
    const text = await readSyncBody(request)
    if (text === null) return reply({status: 'invalid_input'}, 413)
    let input: unknown
    try {
      input = JSON.parse(text)
    } catch {
      return reply({status: 'invalid_input'}, 400)
    }
    const result = (await accountRepository.syncNote(
      session.user.id,
      input,
    )) ?? {status: 'unavailable' as const}
    if (result.status === 'success') {
      // Fresh list reads happen on leave, not an RSC/list refresh per autosave.
      try {
        for (const tag of getNoteMutationCacheKeys(
          session.user.id,
          result.note.id,
        ))
          revalidateTag(tag, 'max')
      } catch {
        /* A cache failure cannot undo a committed save. */
      }
    }
    return reply(result)
  } catch {
    return reply({status: 'retryable_error'}, 503)
  }
}
