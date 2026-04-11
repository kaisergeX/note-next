'use server'

import {and, desc, eq} from 'drizzle-orm'
import type {Session} from 'next-auth'
import {cacheLife, cacheTag} from 'next/cache'
import type {Exact} from '~/types'
import {objectRemoveProperties} from '~/util'
import {getNoteCacheKey, getNoteListCacheKey} from '.'
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

export async function getCachedListNote(session: Session) {
  'use cache'

  cacheLife('neverRevalidate')
  const email = session.user.email
  cacheTag(getNoteListCacheKey(email))
  return await getListNote(email)
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

export async function getCachedNote(session: Session, noteId: string) {
  'use cache'

  cacheLife('neverRevalidate')
  cacheTag(getNoteCacheKey(noteId))
  return await getNote(noteId, session.user.email)
}

export async function updateNote<T extends Exact<UpdateNote, T>>(
  noteId: string,
  note: T,
) {
  const updateData = objectRemoveProperties(
    note,
    ([k]) =>
      ![
        'updatedAt',
        'createdAt',
        /**
         * Currently ISO date string (eg 2023-07-28T16:03:22.836Z) is not supported by drizzle-orm's timestamp mode `date`
         *
         * https://github.com/drizzle-team/drizzle-orm/issues/1757
         * https://github.com/drizzle-team/drizzle-orm/issues/1113
         */
        'pendingDeleteAt',
      ].includes(k),
  )

  return await db
    .update(notesTable)
    .set(updateData)
    .where(eq(notesTable.id, noteId))
  // .returning()
}

export async function deleteNote(noteId: string) {
  return await db.delete(notesTable).where(eq(notesTable.id, noteId))
}
