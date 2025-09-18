import {eq} from 'drizzle-orm'
import {unstable_cache} from 'next/cache'
import {getUserCacheKey, getUserRoleCacheKey} from '.'
import {db} from '..'
import {usersTable, type NewUser, type UpdateUser} from '../schema/users'

export async function getUserRole(email: string) {
  const result = await db
    .select({role: usersTable.role})
    .from(usersTable)
    .where(eq(usersTable.email, email))

  if (result.length === 0) {
    return null
  }

  return result[0].role
}

export async function getCachedUserRole(email: string) {
  const cacheKey = [getUserRoleCacheKey(email)]
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
    console.error(`User with email ${email} not found`)
    return null
  }

  return result[0]
}

export async function getCachedUser(email: string) {
  const cacheKey = [getUserCacheKey(email)]
  return unstable_cache(async () => getUser(email), cacheKey, {
    tags: cacheKey,
  })()
}

export async function addUser(newUsers: NewUser) {
  try {
    await db.insert(usersTable).values(newUsers).onConflictDoNothing()
    return true
  } catch (error) {
    console.log('Create user error:', error)
    return false
  }
}

/** Remember to revalidateTag(getUserCacheKey(updatedData[0].email)) after updateUser */
export async function updateUser(data: UpdateUser) {
  return await db
    .update(usersTable)
    .set(data)
    .where(eq(usersTable.email, 'khaivd98@gmail.com'))
    .returning()
}
