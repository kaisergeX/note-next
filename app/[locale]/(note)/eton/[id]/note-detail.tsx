'use client'

import {useRouter} from '~/i18n/navigation'
import NoteFullView from '~/components/note/note-full-view'
import {useNoteSession} from '~/components/note/use-note-session'
import type {Note} from '~/db/schema/notes'
import type {RecoveryDraft} from '~/lib/notes/drafts'
import {useSearchParams} from 'next/navigation'
import {noteReturnPath} from '~/lib/notes/navigation'

export default function NoteDetail({
  noteData,
  recovery,
}: {
  noteData?: Note
  recovery?: RecoveryDraft
}) {
  const router = useRouter()
  const source = useSearchParams().get('from')
  const session = useNoteSession(noteData, true, recovery)
  if (!session.ready || !session.identity) return session.recoveryView
  return (
    <NoteFullView
      identity={session.identity}
      editorId={`note-${noteData?.id ?? session.identity}`}
      pending={session.pending}
      error={session.error}
      creating={!noteData}
      onClose={() =>
        void session.saveAndLeave(() => {
          if (source === 'browser-work') router.replace(noteReturnPath(source))
          else window.history.length > 1 ? router.back() : router.push('/eton')
        })
      }
      onTrash={() =>
        void session.trashAndLeave(() => router.replace(noteReturnPath(source)))
      }
    />
  )
}
