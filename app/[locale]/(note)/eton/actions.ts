'use server'

import {updateTag} from 'next/cache'
import {getNoteMutationCacheKeys} from '~/db/helper'
import {accountRepository} from '~/db/helper/account'
import type {createNoteRepository} from '~/db/repositories/notes'
import {
  noteMutationSucceeded,
  type NoteMutationResult,
} from '~/lib/notes/lifecycle'
import {requireAuth} from '~/server-utils'

async function commit(
  operation: (
    repo: ReturnType<typeof createNoteRepository>,
  ) => Promise<NoteMutationResult>,
  ownerId: string,
): Promise<NoteMutationResult> {
  try {
    const result = (await accountRepository.mutateNote(ownerId, operation)) ?? {
      status: 'unavailable' as const,
    }
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
  return commit((repo) => repo.createNote(userInfo.id, input), userInfo.id)
}
export async function mutateNoteAction(noteId: string, input: unknown) {
  const {userInfo} = await requireAuth()
  return commit(
    (repo) => repo.updateNote(userInfo.id, noteId, input),
    userInfo.id,
  )
}
export async function moveNoteToTrashAction(noteId: string, draft?: unknown) {
  const {userInfo} = await requireAuth()
  return commit(
    (repo) => repo.moveNoteToTrash(userInfo.id, noteId, draft),
    userInfo.id,
  )
}

export async function restoreNoteAction(
  noteId: string,
  deadlineToken: unknown,
) {
  const {userInfo} = await requireAuth()
  return commit(
    (repo) => repo.restoreNote(userInfo.id, noteId, deadlineToken),
    userInfo.id,
  )
}

export async function permanentlyDeleteNoteAction(
  noteId: string,
  deadlineToken: unknown,
) {
  const {userInfo} = await requireAuth()
  return commit(
    (repo) =>
      repo.permanentlyDeleteTrashedNote(userInfo.id, noteId, deadlineToken),
    userInfo.id,
  )
}
