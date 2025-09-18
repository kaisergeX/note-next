import 'server-only'

import {redirect} from 'next/navigation'
import {getCachedUser} from '~/db/helper/users'
import {auth} from '../auth'
import {RoleEnum} from '../db/schema/users'
import type {Session} from 'next-auth'

/**
 * This is `next-auth`'s {@link auth} function with auto-redirect if not authenticated.
 * As a result, the returned `session` is non-nullable.
 * ___
 * **DO NOT** use this function in client components.
 * ___
 * @param redirectUrl redirect url for unauthenticated users
 * @default '/login'
 */
export async function requireAuth(redirectUrl = '/login') {
  const session = await auth()
  if (!session || session.error) redirect(redirectUrl)

  // userInfo is non-nullable because of auth.ts ensures that
  // the user must exist in the database if session exists and has no error
  const userInfo = (await getCachedUser(session.user.email))!
  return {
    session,
    userInfo,
    isArchivist: session.user.role === RoleEnum.archivist,
  }
}

export function isValidSession(session: Session | null) {
  return !!session && !session.error
}
