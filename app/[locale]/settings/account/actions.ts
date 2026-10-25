'use server'

import {cookies} from 'next/headers'
import {revalidatePath, updateTag} from 'next/cache'
import {signIn} from '~/auth'
import {accountRepository} from '~/db/helper/account'
import {getNoteListCacheKey, getNoteTrashCacheKey} from '~/db/helper'
import {requireAuth} from '~/server-utils'
import {
  DELETE_INTENT_COOKIE,
  DELETE_VERIFICATION_SECONDS,
  encodeDeleteIntent,
} from '~/lib/account/reauth'

export async function getBulkTrashCountAction(expectedOwnerId: string) {
  const {userInfo} = await requireAuth()
  if (userInfo.id !== expectedOwnerId)
    return {status: 'account_changed' as const}
  try {
    return {
      status: 'success' as const,
      count: await accountRepository.activeNoteCount(userInfo.id),
    }
  } catch {
    return {status: 'retryable_error' as const}
  }
}

export async function moveAllNotesToTrashAction(expectedOwnerId: string) {
  const {userInfo} = await requireAuth()
  if (userInfo.id !== expectedOwnerId)
    return {status: 'account_changed' as const}
  let result
  try {
    result = await accountRepository.moveAllNotesToTrash(userInfo.id)
    if (!result) return {status: 'unavailable' as const}
  } catch {
    console.error('Bulk note trash failed')
    return {status: 'retryable_error' as const}
  }
  try {
    updateTag(getNoteListCacheKey(userInfo.id))
    updateTag(getNoteTrashCacheKey(userInfo.id))
    revalidatePath('/[locale]/(note)', 'layout')
    revalidatePath('/[locale]/settings/account', 'page')
  } catch {
    console.error('Bulk note cache invalidation failed')
  }
  return {status: 'success' as const, count: result.count}
}

export async function beginAccountDeletionAction(
  locale: string,
  expectedOwnerId: string,
) {
  const {userInfo} = await requireAuth()
  if (userInfo.id !== expectedOwnerId)
    return {status: 'account_changed' as const}
  const resolvedLocale = locale === 'vi' ? 'vi' : 'en'
  const intent = await encodeDeleteIntent({
    userId: userInfo.id,
    email: userInfo.email,
    locale: resolvedLocale,
  })
  ;(await cookies()).set(DELETE_INTENT_COOKIE, intent, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DELETE_VERIFICATION_SECONDS,
  })
  await signIn(
    'google',
    {redirectTo: `/${resolvedLocale}/settings/account?confirmDelete=1`},
    {
      prompt: 'select_account',
      max_age: '0',
      login_hint: userInfo.email,
    },
  )
}
