'use server'

import {revalidatePath, revalidateTag} from 'next/cache'
import {db} from '~/db'
import {getNoteCacheKey} from '~/db/helper'
import {deleteNote, updateNote} from '~/db/helper/notes'
import {notesTable, type NewNote, type UpdateNote} from '~/db/schema/notes'

export async function createNoteAction(noteData: NewNote) {
  await db.insert(notesTable).values(noteData)
  revalidatePath('/eton')
}

export async function mutateNoteAction(noteId: string, noteData: UpdateNote) {
  await updateNote(noteId, noteData)
  revalidateTag(getNoteCacheKey(noteId))
}

export async function deleteNoteAction(noteId: string) {
  await deleteNote(noteId)
  revalidatePath('/eton')
}
