'use client'

import {useTranslations} from 'next-intl'
import {useRouter} from '~/i18n/navigation'
import {startTransition, useEffect, useState} from 'react'
import NoteDialog from '~/components/note/note-dialog'
import {useNoteSession} from '~/components/note/use-note-session'
import type {Note} from '~/db/schema/notes'
import {sleep} from '~/util'
import {isMobileNoteView} from '~/lib/notes/mobile'
import {useSearchParams} from 'next/navigation'
import {noteReturnPath, withBrowserWorkReturn} from '~/lib/notes/navigation'

export default function NoteDetailModal({noteData}: {noteData: Note}) {
  const t = useTranslations('note')
  const router = useRouter()
  const search = useSearchParams()
  const source = search.get('from')
  const version = search.get('version')
  const fromBrowserWork = source === 'browser-work'
  const [open, setOpen] = useState(false)
  const session = useNoteSession(noteData)
  useEffect(() => {
    if (isMobileNoteView()) {
      router.replace(
        withBrowserWorkReturn(
          `/full/eton/${noteData.id}${version ? `?version=${encodeURIComponent(version)}` : ''}`,
          fromBrowserWork,
        ),
      )
      return
    }
    startTransition(() => setOpen(true))
  }, [noteData.id, router, fromBrowserWork, version])
  const close = async () => {
    setOpen(false)
    await sleep(200)
    if (fromBrowserWork) router.replace(noteReturnPath(source))
    else window.history.length > 1 ? router.back() : router.push('/eton')
  }
  if (!session.ready) return session.recoveryView
  return (
    <NoteDialog
      open={open}
      loading={session.pending}
      error={
        session.error
          ? t(
              session.error === 'trash'
                ? 'trash.moveFailed'
                : 'status.saveFailed',
            )
          : undefined
      }
      onClose={() => void session.saveAndLeave(close)}
      onMoveToTrash={() =>
        void session.trashAndLeave(() => {
          setOpen(false)
          router.replace(noteReturnPath(source))
        })
      }
    />
  )
}
