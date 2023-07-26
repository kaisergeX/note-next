import {and, desc, eq} from 'drizzle-orm'
import {db} from '..'
import {type UpdateNote, NotesTable} from '../schema/notes'
import {UsersTable} from '../schema/users'

export async function getListNote(userId: string) {
  return await db
    .select()
    .from(NotesTable)
    .where(eq(NotesTable.authorId, userId))
    .orderBy(desc(NotesTable.createdAt))
}

export async function getNote(noteId: string, email: string) {
  const result = await db
    .select()
    .from(NotesTable)
    .innerJoin(UsersTable, eq(NotesTable.authorId, UsersTable.id))
    .where(and(eq(NotesTable.id, noteId), eq(UsersTable.email, email)))

  if (result.length === 0) {
    throw new Error('Note not found')
  }

  return result[0].notes
}

export async function updateNote(noteId: string, note: UpdateNote) {
  return await db
    .update(NotesTable)
    .set(note)
    .where(eq(NotesTable.id, noteId))
    .returning()
}

export async function deleteNote(noteId: string) {
  return await db.delete(NotesTable).where(eq(NotesTable.id, noteId))
}
