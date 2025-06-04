import {eq} from 'drizzle-orm'
import {unstable_cache} from 'next/cache'
import {getUserCacheKey} from '.'
import {db} from '..'
import {usersTable, type UpdateUser} from '../schema/users'

export async function getUserRole(email: string) {
  const result = await db
    .select({role: usersTable.role})
    .from(usersTable)
    .where(eq(usersTable.email, email))

  if (result.length === 0) {
    throw new Error(`User with email ${email} not found`)
  }

  return result[0].role
}

export async function getCachedUserRole(email: string) {
  const cacheKey = [getUserCacheKey(email)]
  return unstable_cache(async () => getUserRole(email), cacheKey, {
    tags: cacheKey,
  })()
}

export async function getUser(email: string) {
  const result = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email))

  if (result.length === 0) {
    throw new Error(`User with email ${email} not found`)
  }

  return result[0]
}

/** Remember to revalidateTag(getUserCacheKey(updatedData[0].email)) after updateUser */
export async function updateUser(data: UpdateUser) {
  return await db
    .update(usersTable)
    .set(data)
    .where(eq(usersTable.email, 'khaivd98@gmail.com'))
    .returning()
}
