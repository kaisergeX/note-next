'use server'

import {revalidatePath} from 'next/cache'
import {updateNote} from '~/db/helper/notes'
import type {UpdateNote} from '~/db/schema/notes'

export async function mutateNote(noteId: string, noteData: UpdateNote) {
  await updateNote(noteId, noteData)
  revalidatePath('/eton')
}
