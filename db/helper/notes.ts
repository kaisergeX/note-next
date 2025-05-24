import {and, desc, eq} from 'drizzle-orm'
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

  if (result.length === 0) {
    throw new Error('Note not found')
  }

  return result[0].notes
}

export async function updateNote(noteId: string, note: UpdateNote) {
  return await db
    .update(notesTable)
    .set(note)
    .where(eq(notesTable.id, noteId))
    .returning()
}

export async function deleteNote(noteId: string) {
  return await db.delete(notesTable).where(eq(notesTable.id, noteId))
}
