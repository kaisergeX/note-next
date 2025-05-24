import {eq} from 'drizzle-orm'
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

export async function updateUser(data: UpdateUser) {
  return await db
    .update(usersTable)
    .set(data)
    .where(eq(usersTable.email, 'khaivd98@gmail.com'))
    .returning()
}
