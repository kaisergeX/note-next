'use server'

import {revalidateTag} from 'next/cache'
import {db} from '~/db'
import {getNoteCacheKey, getNoteListCacheKey} from '~/db/helper'
import {deleteNote, updateNote} from '~/db/helper/notes'
import {
  notesTable,
  type DisallowedUpdateNoteKeys,
  type NewNote,
  type Note,
  type UpdateNote,
} from '~/db/schema/notes'
import {requireAuth} from '~/server-utils'

const FILTER_NOTE_KEYS = Object.freeze([
  'id',
  'authorId',
  'createdAt',
  'updatedAt',
] satisfies DisallowedUpdateNoteKeys[])

export async function createNoteAction(noteData: NewNote) {
  const {session} = await requireAuth()
  const email = session.user.email
  await db.insert(notesTable).values(noteData)
  revalidateTag(getNoteListCacheKey(email))
}

export async function mutateNoteAction(noteId: string, noteData: Note) {
  const {session} = await requireAuth()
  const email = session.user.email

  const updateData: UpdateNote = Object.fromEntries(
    Object.entries(noteData).filter(
      ([k]) =>
        !FILTER_NOTE_KEYS.includes(
          k as DisallowedUpdateNoteKeys, // this also makes sure all disallowed keys are included in FILTER_NOTE_KEYS
        ),
    ),
  )

  if (Object.keys(updateData).length === 0) return

  await updateNote(noteId, updateData)
  revalidateTag(getNoteCacheKey(noteId))
  revalidateTag(getNoteListCacheKey(email))
}

export async function deleteNoteAction(noteId: string) {
  const {session} = await requireAuth()
  const email = session.user.email
  await deleteNote(noteId)
  revalidateTag(getNoteListCacheKey(email))
}
