'use server'

import {revalidatePath} from 'next/cache'
import {db} from '~/db'
import {deleteNote, updateNote} from '~/db/helper/notes'
import {NotesTable, type NewNote, type UpdateNote} from '~/db/schema/notes'

export async function createNoteAction(noteData: NewNote) {
  await db.insert(NotesTable).values(noteData)
  revalidatePath('/eton')
}

export async function mutateNoteAction(noteId: string, noteData: UpdateNote) {
  await updateNote(noteId, noteData)
  revalidatePath('/eton')
}

export async function deleteNoteAction(noteId: string) {
  await deleteNote(noteId)
  revalidatePath('/eton')
}
