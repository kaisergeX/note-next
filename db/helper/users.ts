import {eq} from 'drizzle-orm'
import {db} from '..'
import {UsersTable, type UpdateUser} from '../schema/users'

export async function getUserRole(email: string) {
  const result = await db
    .select({role: UsersTable.role})
    .from(UsersTable)
    .where(eq(UsersTable.email, email))

  if (result.length === 0) {
    throw new Error(`User with email ${email} not found`)
  }

  return result[0].role
}

export async function getUser(email: string) {
  const result = await db
    .select()
    .from(UsersTable)
    .where(eq(UsersTable.email, email))

  if (result.length === 0) {
    throw new Error(`User with email ${email} not found`)
  }

  return result[0]
}

export async function updateUser(data: UpdateUser) {
  return await db
    .update(UsersTable)
    .set(data)
    .where(eq(UsersTable.email, 'khaivd98@gmail.com'))
    .returning()
}
