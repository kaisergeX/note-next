import {and, desc, eq} from 'drizzle-orm'
import {unstable_cache} from 'next/cache'
import {requireAuth} from '~/util'
import {getNoteCacheKey} from '.'
import {db} from '..'
import {type UpdateNote, notesTable} from '../schema/notes'
import {usersTable} from '../schema/users'

export async function getListNote(userId: string) {
  return await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.authorId, userId))
    .orderBy(desc(notesTable.createdAt))
}

export async function getNote(noteId: string, email: string) {
  const result = await db
    .select()
    .from(notesTable)
    .innerJoin(usersTable, eq(notesTable.authorId, usersTable.id))
    .where(and(eq(notesTable.id, noteId), eq(usersTable.email, email)))

  if (!Array.isArray(result) || !result[0]?.notes) {
    throw new Error('Note not found')
  }

  return result[0].notes
}

export async function getCachedNote(noteId: string) {
  const session = await requireAuth()
  const email = session.user.email,
    cacheKey = [getNoteCacheKey(noteId)]
  return unstable_cache(
    async () => getNote(noteId, email),
    cacheKey,
    // {revalidate: NOTE_CACHE_REVALIDATE_TIME}
    {tags: cacheKey},
  )()
}

export async function updateNote(noteId: string, note: UpdateNote) {
  const updateData = Object.assign({}, note)
  Reflect.deleteProperty(updateData, 'updatedAt')
  Reflect.deleteProperty(updateData, 'createdAt')

  /**
   * Currently ISO date string (eg 2023-07-28T16:03:22.836Z) is not supported by drizzle-orm's timestamp mode `date`
   *
   * https://github.com/drizzle-team/drizzle-orm/issues/1757
   * https://github.com/drizzle-team/drizzle-orm/issues/1113
   */
  Reflect.deleteProperty(updateData, 'pendingDeleteAt')

  return await db
    .update(notesTable)
    .set(updateData)
    .where(eq(notesTable.id, noteId))
  // .returning()
}

export async function deleteNote(noteId: string) {
  return await db.delete(notesTable).where(eq(notesTable.id, noteId))
}
