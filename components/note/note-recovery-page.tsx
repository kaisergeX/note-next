'use client'

import {useEffect, useState} from 'react'
import {useTranslations} from 'next-intl'
import {listDrafts, type RecoveryDraft} from '~/lib/notes/drafts'
import type {Note} from '~/db/schema/notes'
import NoteDetail from '~/app/[locale]/(note)/eton/[id]/note-detail'
import Button from '~/components/ui/button'
import {Link} from '~/i18n/navigation'

export default function NoteRecoveryPage({
  ownerId,
  draftId,
}: {
  ownerId: string
  draftId: string
}) {
  const t = useTranslations('note')
  const [value, setValue] = useState<{record: RecoveryDraft; note?: Note}>()
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const record = (await listDrafts(ownerId)).find(
          (row) => row.id === draftId,
        )
        if (!record) {
          if (active) setError(true)
          return
        }
        let note: Note | undefined
        if (record.noteId) {
          const response = await fetch(`/api/note/${record.noteId}`, {
            cache: 'no-store',
          })
          if (response.status === 404) record.unavailable = true
          else if (!response.ok) throw new Error('Recovery unavailable')
          else note = (await response.json()) as Note
        }
        if (active) {
          setValue({record, note})
          setError(false)
        }
      } catch {
        if (active) setError(true)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [ownerId, draftId, attempt])
  if (value) return <NoteDetail noteData={value.note} recovery={value.record} />
  return (
    <main className="mx-auto w-full max-w-xl p-4">
      {error ? (
        <>
          <p role="alert" className="text-destructive">
            {t('recovery.recoveryFailed')}
          </p>
          <Button
            className="mt-4"
            onClick={() => setAttempt((value) => value + 1)}
          >
            {t('recovery.retry')}
          </Button>
        </>
      ) : (
        <p role="status">{t('recovery.opening')}</p>
      )}
      <Link
        className="text-accent mt-4 block underline underline-offset-4"
        href="/eton"
      >
        {t('collections.all')}
      </Link>
    </main>
  )
}
