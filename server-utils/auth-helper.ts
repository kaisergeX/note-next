import 'server-only'

import {redirect} from 'next/navigation'
import {getUserById} from '~/db/helper/users'
import {auth} from '../auth'
import {RoleEnum} from '../db/schema/users'
import type {Session} from 'next-auth'
import type {Route} from 'next'
import {connection} from 'next/server'

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
  await connection()
  const session = await auth()
  if (!session?.user?.id || session.error) redirect(redirectUrl as Route)

  const userInfo = await getUserById(session.user.id)
  if (!userInfo) redirect(redirectUrl as Route)
  return {
    session,
    userInfo,
    isArchivist: session.user.role === RoleEnum.archivist,
  }
}

export function isValidSession(session: Session | null) {
  return !!session && !session.error
}
