'use client'

import {createElement, useLayoutEffect, useRef, useState} from 'react'
import {useSession} from 'next-auth/react'
import {useSearchParams} from 'next/navigation'
import type {Note} from '~/db/schema/notes'
import {listDrafts, type RecoveryDraft} from '~/lib/notes/drafts'
import {noteRecoveryGroups} from '~/lib/notes/recovery-copies'
import {useRouter} from '~/i18n/navigation'
import {useTranslations} from 'next-intl'
import Button from '~/components/ui/button'
import NoteVersionPicker from './note-version-picker'
import {beginNoteSync, getNoteSync} from '~/lib/notes/session-sync'
import {sameContent} from '~/lib/notes/sync'
import {usePersistStore} from '~/store'
import {noteReturnPath} from '~/lib/notes/navigation'

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
  const session = usePersistStore((state) => state.noteSession)
  const current = getNoteSync()
  const key = recovery
    ? current?.record.ownerId === ownerId && current?.record.id === recovery.id
      ? (session?.key ?? `recovery:${recovery.id}`)
      : `recovery:${recovery.id}`
    : note
      ? `${note.authorId}:${note.id}`
      : `new:${ownerId}`
  const router = useRouter()
  const search = useSearchParams()
  const returnPath = noteReturnPath(search.get('from'))
  const versionId = search.get('version')
  const t = useTranslations('note.recovery')
  const [selection, setSelection] = useState<{
    key: string
    records: RecoveryDraft[]
    error?: boolean
  }>()
  const [attempt, setAttempt] = useState(0)
  const leaving = useRef<string | undefined>(undefined)
  const documentKey = `${ownerId}:${recovery?.id ?? note?.id ?? 'new'}`
  useLayoutEffect(
    () => () => {
      // Cached routes disconnect layout effects when hidden. A later visit may
      // resume this view after its outgoing navigation has finished.
      leaving.current = undefined
    },
    [],
  )
  useLayoutEffect(() => {
    let alive = true
    if (!active) leaving.current = undefined
    // A successful leave clears the store before asynchronous navigation
    // unmounts this view. Do not resume its outgoing recovery snapshot again.
    if (leaving.current === documentKey) return
    if (active && ownerId && (!note || note.authorId === ownerId)) {
      // Effect reruns resume the mounted session; only explicit version choices
      // may replace it with the supplied recovery snapshot.
      if (
        recovery &&
        getNoteSync()?.record.ownerId === ownerId &&
        usePersistStore.getState().noteSession?.key === key
      )
        return
      if (
        recovery ||
        !note ||
        (getNoteSync()?.record.ownerId === ownerId &&
          usePersistStore.getState().noteSession?.key === key)
      ) {
        beginNoteSync(ownerId, key, note, recovery)
      } else
        void listDrafts(ownerId).then(
          (records) => {
            if (!alive) return
            const groups = noteRecoveryGroups(records, ownerId, note.id)
            const candidates = groups.flatMap((group) => group.copies)
            const selected = versionId
              ? candidates.find((row) => row.versionId === versionId)
              : undefined
            if (versionId)
              beginNoteSync(ownerId, key, note, selected, !selected)
            else if (groups.length > 1) setSelection({key, records: candidates})
            else
              beginNoteSync(
                ownerId,
                key,
                note,
                groups[0]?.record,
                !groups.length,
              )
          },
          () => {
            if (alive) setSelection({key, records: [], error: true})
          },
        )
    }
    return () => {
      alive = false
    }
  }, [active, ownerId, key, note, recovery, attempt, documentKey, versionId])
  const recoveryView =
    selection?.key === key && ownerId && note
      ? selection.error
        ? createElement(
            'div',
            {className: 'bg-paper-raised p-4', role: 'alert'},
            createElement('p', null, t('recoveryFailed')),
            createElement(
              Button,
              {onClick: () => setAttempt((value) => value + 1)},
              t('retry'),
            ),
          )
        : createElement(NoteVersionPicker, {
            note,
            records: selection.records,
            onClose: () => router.replace(returnPath),
            onChoose: (record?: RecoveryDraft) => {
              setSelection(undefined)
              if (
                record?.versionId ||
                selection.records.some((row) => row.versionId)
              ) {
                const url = new URL(window.location.href)
                url.searchParams.set('version', record?.versionId ?? 'saved')
                window.history.replaceState(null, '', url.href)
              }
              beginNoteSync(ownerId, key, note, record, !record)
            },
          })
      : null
  return {
    recoveryView,
    identity: session?.identity,
    ready:
      active &&
      getNoteSync()?.record.ownerId === ownerId &&
      session?.key === key &&
      session.hydrated,
    pending: session?.key === key && Boolean(session.operation),
    error: session?.key === key ? session.error : undefined,
    saveAndLeave: (onSuccess: () => void | Promise<void>) =>
      getNoteSync()?.leave('save', () => {
        leaving.current = documentKey
        return onSuccess()
      }),
    trashAndLeave: (onSuccess: () => void | Promise<void>) =>
      getNoteSync()?.leave('trash', () => {
        leaving.current = documentKey
        return onSuccess()
      }),
  }
}
