import {revalidateTag} from 'next/cache'
import {accountRepository} from '~/db/helper/account'
import {
  getUserCacheKey,
  getUserRoleCacheKey,
  getNoteListCacheKey,
  getNoteTrashCacheKey,
} from '~/db/helper'
import {hasFreshDeleteVerification} from '~/lib/account/reauth'
import {defineAuthRoute} from '~/server-utils'

export const DELETE = defineAuthRoute(async ({request, session}) => {
  const headers = {'Cache-Control': 'private, no-store'}
  if (request.headers.get('origin') !== request.nextUrl.origin)
    return Response.json({error: 'invalid_origin'}, {status: 403, headers})
  if (!hasFreshDeleteVerification(session.accountDeleteVerifiedAt))
    return Response.json(
      {error: 'verification_required'},
      {status: 403, headers},
    )
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({error: 'invalid_input'}, {status: 400, headers})
  }
  if (
    !body ||
    typeof body !== 'object' ||
    !('email' in body) ||
    body.email !== session.user.email
  )
    return Response.json({error: 'email_mismatch'}, {status: 400, headers})
  if (!('ownerId' in body) || body.ownerId !== session.user.id)
    return Response.json({error: 'account_changed'}, {status: 409, headers})
  try {
    const result = await accountRepository.deleteAccount(session.user.id)
    if (!result)
      return Response.json({error: 'unavailable'}, {status: 401, headers})
  } catch {
    console.error('Account deletion failed')
    return Response.json({error: 'retryable_error'}, {status: 500, headers})
  }
  // The deletion is committed. Cache failures must not imply it was rolled back.
  try {
    for (const tag of [
      getUserCacheKey(session.user.email),
      getUserRoleCacheKey(session.user.email),
      getNoteListCacheKey(session.user.id),
      getNoteTrashCacheKey(session.user.id),
    ])
      revalidateTag(tag, {expire: 0})
  } catch {
    console.error('Deleted account cache invalidation failed')
  }
  return Response.json({status: 'success'}, {headers})
})
