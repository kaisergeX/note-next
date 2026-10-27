'use client'

import {useLayoutEffect} from 'react'
import {useSession} from 'next-auth/react'
import type {Note} from '~/db/schema/notes'
import type {RecoveryDraft} from '~/lib/notes/drafts'
import {beginNoteSync, getNoteSync} from '~/lib/notes/session-sync'
import {sameContent} from '~/lib/notes/sync'
import {usePersistStore} from '~/store'

export const noteDraftChanged = (
  draft: Partial<Note> | undefined,
  baseline: Partial<Note>,
) => !sameContent(draft ?? {}, baseline)

export function useNoteSession(
  note?: Note,
  active = true,
  recovery?: RecoveryDraft,
) {
  const {data: auth} = useSession()
  const ownerId = auth?.user?.id
  const key = recovery
    ? `recovery:${recovery.id}`
    : note
      ? `${note.authorId}:${note.id}`
      : `new:${ownerId}`
  const session = usePersistStore((state) => state.noteSession)
  useLayoutEffect(() => {
    if (active && ownerId && (!note || note.authorId === ownerId))
      beginNoteSync(ownerId, key, note, recovery)
  }, [active, ownerId, key, note, recovery])
  return {
    identity: session?.identity,
    ready: active && session?.key === key && session.hydrated,
    pending: session?.key === key && Boolean(session.operation),
    error: session?.key === key ? session.error : undefined,
    saveAndLeave: (onSuccess: () => void | Promise<void>) =>
      getNoteSync()?.leave('save', onSuccess),
    trashAndLeave: (onSuccess: () => void | Promise<void>) =>
      getNoteSync()?.leave('trash', onSuccess),
  }
}
