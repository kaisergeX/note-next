'use server'

import {updateTag} from 'next/cache'
import {getNoteMutationCacheKeys} from '~/db/helper'
import {noteRepository} from '~/db/helper/notes'
import {
  noteMutationSucceeded,
  type NoteMutationResult,
} from '~/lib/notes/lifecycle'
import {requireAuth} from '~/server-utils'

async function commit(
  operation: () => Promise<NoteMutationResult>,
  ownerId: string,
): Promise<NoteMutationResult> {
  try {
    const result = await operation()
    if (noteMutationSucceeded(result)) {
      for (const tag of getNoteMutationCacheKeys(ownerId, result.note.id))
        updateTag(tag)
    }
    return result
  } catch {
    // Database exceptions may include note bodies in SQL parameters.
    console.error('Note mutation failed')
    return {status: 'retryable_error'}
  }
}
export async function createNoteAction(input: unknown) {
  const {userInfo} = await requireAuth()
  return commit(
    () => noteRepository.createNote(userInfo.id, input),
    userInfo.id,
  )
}
export async function mutateNoteAction(noteId: string, input: unknown) {
  const {userInfo} = await requireAuth()
  return commit(
    () => noteRepository.updateNote(userInfo.id, noteId, input),
    userInfo.id,
  )
}
export async function deleteNoteAction(noteId: string) {
  const {userInfo} = await requireAuth()
  return commit(
    () => noteRepository.deleteActiveNote(userInfo.id, noteId),
    userInfo.id,
  )
}
