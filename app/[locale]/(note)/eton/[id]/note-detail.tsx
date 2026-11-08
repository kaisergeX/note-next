'use client'

import {useRouter} from '~/i18n/navigation'
import NoteFullView from '~/components/note/note-full-view'
import {useNoteSession} from '~/components/note/use-note-session'
import type {Note} from '~/db/schema/notes'
import type {RecoveryDraft} from '~/lib/notes/drafts'
import {useSearchParams} from 'next/navigation'
import {noteReturnPath} from '~/lib/notes/navigation'
import {useTranslations} from 'next-intl'
import {NoteEditorLoading} from '~/components/note/note-loading'

export default function NoteDetail({
  noteData,
  recovery,
}: {
  noteData?: Note
  recovery?: RecoveryDraft
}) {
  const router = useRouter()
  const t = useTranslations('note.loading')
  const source = useSearchParams().get('from')
  const session = useNoteSession(noteData, true, recovery)
  if (!session.ready || !session.identity)
    return session.recoveryView ?? <NoteEditorLoading label={t('editor')} />
  return (
    <NoteFullView
      identity={session.identity}
      editorId={`note-${noteData?.id ?? session.identity}`}
      pending={session.pending}
      error={session.error}
      creating={!noteData}
      onClose={() =>
        void session.saveAndLeave(() => {
          router.replace(noteReturnPath(source))
        })
      }
      onTrash={() =>
        void session.trashAndLeave(() => router.replace(noteReturnPath(source)))
      }
    />
  )
}
