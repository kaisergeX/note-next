'use client'

import {useTranslations} from 'next-intl'
import {useRouter} from '~/i18n/navigation'
import {startTransition, useEffect, useState} from 'react'
import NoteDialog from '~/components/note/note-dialog'
import {useNoteSession} from '~/components/note/use-note-session'
import type {Note} from '~/db/schema/notes'
import {sleep} from '~/util'
import {isMobileNoteView} from '~/lib/notes/mobile'

export default function NoteDetailModal({noteData}: {noteData: Note}) {
  const t = useTranslations('note')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const session = useNoteSession(noteData)
  useEffect(() => {
    if (isMobileNoteView()) {
      router.replace(`/full/eton/${noteData.id}`)
      return
    }
    startTransition(() => setOpen(true))
  }, [noteData.id, router])
  const close = async () => {
    setOpen(false)
    await sleep(200)
    window.history.length > 1 ? router.back() : router.push('/eton')
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
          router.replace('/eton')
        })
      }
    />
  )
}
