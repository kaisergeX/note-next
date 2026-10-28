'use client'

import {useEffect, useState} from 'react'
import {useTranslations} from 'next-intl'
import {exportDrafts, listDrafts, type RecoveryDraft} from '~/lib/notes/drafts'
import type {Note} from '~/db/schema/notes'
import NoteDetail from '~/app/[locale]/(note)/eton/[id]/note-detail'
import Button from '~/components/ui/button'
import {Link} from '~/i18n/navigation'
import {useRouter} from '~/i18n/navigation'
import {useSearchParams} from 'next/navigation'
import {groupRecoveryDrafts, recoveryNoteId} from '~/lib/notes/recovery-copies'
import NoteVersionPicker from './note-version-picker'

export default function NoteRecoveryPage({
  ownerId,
  draftId,
}: {
  ownerId: string
  draftId: string
}) {
  const t = useTranslations('note')
  const router = useRouter()
  const search = useSearchParams()
  const [choices, setChoices] = useState<RecoveryDraft[]>()
  const [value, setValue] = useState<{record: RecoveryDraft; note?: Note}>()
  const [error, setError] = useState(false)
  const [localRecord, setLocalRecord] = useState<RecoveryDraft>()
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const records = await listDrafts(ownerId)
        const record = records.find((row) => row.id === draftId)
        if (!record) {
          if (active) setError(true)
          return
        }
        if (active) setLocalRecord(record)
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
          const related = records.filter(
            (row) => recoveryNoteId(row) === recoveryNoteId(record),
          )
          if (search.get('review') && groupRecoveryDrafts(related).length > 1)
            setChoices(related)
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
  }, [ownerId, draftId, attempt, search])
  if (value && choices)
    return (
      <NoteVersionPicker
        note={value.note}
        records={choices}
        onClose={() => router.replace('/eton')}
        onChoose={(record) => {
          setChoices(undefined)
          if (record) setValue({...value, record})
          else if (value.note) router.replace(`/full/eton/${value.note.id}`)
        }}
      />
    )
  if (value) return <NoteDetail noteData={value.note} recovery={value.record} />
  return (
    <main className="mx-auto w-full max-w-xl p-4">
      {error ? (
        <>
          <p role="alert" className="text-destructive">
            {t(
              localRecord
                ? 'recovery.refreshFailed'
                : 'recovery.recoveryFailed',
            )}
          </p>
          <Button
            className="mt-4"
            onClick={() => setAttempt((value) => value + 1)}
          >
            {t('recovery.retry')}
          </Button>
          {localRecord && (
            <Button variant="ghost" onClick={() => exportDrafts([localRecord])}>
              {t('recovery.export')}
            </Button>
          )}
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
