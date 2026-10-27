'use client'

import {useLayoutEffect} from 'react'
import {
  createNoteAction,
  mutateNoteAction,
  moveNoteToTrashAction,
} from '~/app/[locale]/(note)/eton/actions'
import type {Note} from '~/db/schema/notes'
import {performNoteMutation} from '~/lib/notes/client-mutation'
import {noteMutationSucceeded} from '~/lib/notes/lifecycle'
import {pickNoteContent} from '~/lib/notes/validation'
import {usePersistStore} from '~/store'

export function noteDraftChanged(
  draft: Partial<Note> | undefined,
  baseline: Partial<Note>,
) {
  return (['title', 'content', 'theme'] as const).some(
    (key) => (draft?.[key] || null) !== (baseline[key] || null),
  )
}

// One memory-only session follows a note between modal and full-page routes.
// Unmount is a handoff, never a write or a reset. Explicit successful leave (or
// the existing account-data clear) ends the session. No durable recovery here.
export function useNoteSession(note?: Note, active = true) {
  const key = note ? `${note.authorId}:${note.id}` : 'new'
  const session = usePersistStore((state) => state.noteSession)
  const begin = usePersistStore((state) => state.beginNoteSession)
  useLayoutEffect(() => {
    if (!active) return
    begin(key, note)
    const identity = usePersistStore.getState().noteSession?.identity
    // Creation has no modal/full-page handoff. Match its existing discard on
    // unmount behavior so an unsaved new note cannot follow an account switch.
    return () => {
      if (
        !note &&
        usePersistStore.getState().noteSession?.identity === identity
      ) {
        usePersistStore.getState().setMutateNoteData(undefined)
      }
    }
  }, [active, begin, key, note])

  async function leave(
    kind: 'save' | 'trash',
    onSuccess: () => void | Promise<void>,
  ) {
    const state = usePersistStore.getState()
    const current = state.noteSession
    if (!current || current.key !== key || current.operation) return
    const draft = state.mutateNoteData
    const operation = {...current, operation: kind, error: undefined}
    usePersistStore.setState({noteSession: operation})
    const input = pickNoteContent(draft ?? {})
    const savedId = current.baseline.id ?? note?.id
    const shouldWrite =
      kind === 'trash' ||
      (savedId
        ? noteDraftChanged(draft, current.baseline)
        : Boolean(draft?.title || draft?.content))
    if (shouldWrite) {
      const result = await performNoteMutation(() =>
        kind === 'trash' && savedId
          ? moveNoteToTrashAction(savedId, {
              title: input.title ?? null,
              content: input.content ?? null,
              theme: input.theme ?? null,
            })
          : savedId
            ? mutateNoteAction(savedId, input)
            : createNoteAction(input),
      )
      // Account deletion/bulk Trash can clear a session while a request runs.
      if (usePersistStore.getState().noteSession !== operation) return
      if (!noteMutationSucceeded(result)) {
        usePersistStore.setState({noteSession: {...current, error: kind}})
        return
      }
      // Record only the acknowledged snapshot. Never merge a server response
      // over the current draft or replace editor content/history.
      const newerChanges =
        kind === 'save' &&
        noteDraftChanged(usePersistStore.getState().mutateNoteData, input)
      usePersistStore.setState({
        noteSession: {
          ...current,
          baseline: result.note,
          operation: newerChanges ? undefined : kind,
        },
      })
      // An IME commit or other late field update must survive the request.
      // A successful create's id stays in the baseline so the next explicit
      // close updates that note rather than creating another one.
      if (newerChanges) return
    }
    await onSuccess()
    if (usePersistStore.getState().noteSession?.identity === current.identity) {
      usePersistStore.getState().setMutateNoteData(undefined)
    }
  }
  return {
    identity: session?.identity,
    ready: active && session?.key === key,
    pending: session?.key === key && Boolean(session.operation),
    error: session?.key === key ? session.error : undefined,
    saveAndLeave: (onSuccess: () => void | Promise<void>) =>
      leave('save', onSuccess),
    trashAndLeave: (onSuccess: () => void | Promise<void>) =>
      leave('trash', onSuccess),
  }
}
