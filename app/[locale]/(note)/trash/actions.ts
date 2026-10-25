'use server'

import {unstable_rethrow} from 'next/navigation'
import {revalidatePath, updateTag} from 'next/cache'
import {accountRepository} from '~/db/helper/account'
import {noteRepository} from '~/db/helper/notes'
import {
  getNoteListCacheKey,
  getNoteTrashCacheKey,
  getNoteCacheKey,
} from '~/db/helper'
import {requireAuth} from '~/server-utils'
import {EMPTY_TRASH_PHRASES, type TrashBulkResult} from '~/lib/notes/trash-bulk'

export async function previewTrashAction(expectedOwnerId: string) {
  const {userInfo} = await requireAuth()
  if (userInfo.id !== expectedOwnerId)
    return {status: 'account_changed' as const}
  try {
    return {
      status: 'success' as const,
      ...(await accountRepository.previewTrash(userInfo.id)),
    }
  } catch {
    return {status: 'retryable_error' as const}
  }
}

export async function readTrashNoteAction(
  expectedOwnerId: string,
  noteId: string,
  deadlineToken: string,
) {
  const {userInfo} = await requireAuth()
  if (userInfo.id !== expectedOwnerId)
    return {status: 'account_changed' as const}
  try {
    const note = await noteRepository.getTrashNote(userInfo.id, noteId)
    if (!note || note.deadlineToken !== deadlineToken)
      return {status: 'unavailable' as const}
    return {status: 'success' as const, note}
  } catch (error) {
    unstable_rethrow(error)
    return {status: 'retryable_error' as const}
  }
}

async function mutate(
  expectedOwnerId: string,
  snapshot: unknown,
  remove: boolean,
  confirmation?: string,
): Promise<TrashBulkResult> {
  const {userInfo} = await requireAuth()
  if (userInfo.id !== expectedOwnerId) return {status: 'account_changed'}
  if (
    remove &&
    confirmation !== EMPTY_TRASH_PHRASES.en &&
    confirmation !== EMPTY_TRASH_PHRASES.vi
  )
    return {status: 'invalid_input'}
  let result
  try {
    result = await (remove
      ? accountRepository.emptyTrash(userInfo.id, snapshot)
      : accountRepository.restoreAllTrash(userInfo.id, snapshot))
  } catch (error) {
    unstable_rethrow(error)
    console.error('Bulk trash mutation failed')
    return {status: 'retryable_error'}
  }
  if (!result) return {status: 'unavailable'}
  if (result.status !== 'success') return result
  try {
    updateTag(getNoteListCacheKey(userInfo.id))
    updateTag(getNoteTrashCacheKey(userInfo.id))
    for (const id of result.ids) updateTag(getNoteCacheKey(userInfo.id, id))
    revalidatePath('/[locale]/(note)', 'layout')
    revalidatePath('/[locale]/settings/account', 'page')
  } catch {
    console.error('Bulk trash cache invalidation failed')
  }
  return {status: 'success', count: result.count}
}

export async function restoreAllTrashAction(
  expectedOwnerId: string,
  snapshot: unknown,
) {
  return mutate(expectedOwnerId, snapshot, false)
}

export async function emptyTrashAction(
  expectedOwnerId: string,
  snapshot: unknown,
  confirmation: string,
): Promise<TrashBulkResult> {
  return mutate(expectedOwnerId, snapshot, true, confirmation)
}
