'use server'

import {revalidatePath} from 'next/cache'
import {db} from '~/db'
import {updateNote} from '~/db/helper/notes'
import {NotesTable, type NewNote, type UpdateNote} from '~/db/schema/notes'

export async function createNote(noteData: NewNote) {
  await db.insert(NotesTable).values(noteData)
  revalidatePath('/eton')
}

export async function mutateNote(noteId: string, noteData: UpdateNote) {
  await updateNote(noteId, noteData)
  revalidatePath('/eton')
}
