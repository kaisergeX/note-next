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
import {usePersistStore} from '~/store'
import {beginNoteSync, getNoteSync} from '~/lib/notes/session-sync'
import {noteReturnPath, withBrowserWorkReturn} from '~/lib/notes/navigation'

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
  const fromBrowserWork = search.get('from') === 'browser-work'
  const returnPath = noteReturnPath(search.get('from'))
  const reviewing = Boolean(search.get('review'))
  const recoveryId = search.get('draft') ?? draftId
  const session = usePersistStore((state) => state.noteSession)
  const [choices, setChoices] = useState<RecoveryDraft[]>()
  const [value, setValue] = useState<{record: RecoveryDraft; note?: Note}>()
  const [error, setError] = useState(false)
  const [localRecord, setLocalRecord] = useState<RecoveryDraft>()
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = getNoteSync()
    if (
      !value ||
      choices ||
      !session?.hydrated ||
      session.operation ||
      (session.key !== `recovery:${value.record.id}` &&
        controller?.record.id !== value.record.id) ||
      controller?.record.ownerId !== ownerId ||
      (!controller.localSafe && controller.dirty)
    )
      return
    // Retired source IDs cannot be reloaded. Native history preserves the
    // mounted editors while pointing reloads at durable work or its saved note.
    const url = new URL(window.location.href)
    if (!/\/full\/eton\/(?:recover\/[^/]+|[^/]+)$/.test(url.pathname)) return
    if (controller.record.noteId && !controller.record.unavailable) {
      url.pathname = url.pathname.replace(
        /\/full\/eton\/recover\/[^/]+$/,
        `/full/eton/${controller.record.noteId}`,
      )
      url.searchParams.delete('draft')
      if (controller.record.versionId)
        url.searchParams.set('version', controller.record.versionId)
    } else {
      // Keep the segment stable so an RSC refresh preserves the editor tree.
      url.searchParams.set('draft', controller.record.id)
    }
    window.history.replaceState(null, '', url.href)
  }, [session, value, choices, ownerId])
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const records = await listDrafts(ownerId)
        const record = records.find((row) => row.id === recoveryId)
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
          if (reviewing && groupRecoveryDrafts(related).length > 1)
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
  }, [ownerId, recoveryId, attempt, reviewing])
  if (value && choices)
    return (
      <NoteVersionPicker
        note={value.note}
        records={choices}
        onClose={() => router.replace(returnPath)}
        onChoose={(record) => {
          if (record) {
            setChoices(undefined)
            setValue({...value, record})
          } else if (value.note) {
            // Keep the chooser mounted until navigation; rendering the old
            // recovery editor here would resume it over the saved selection.
            beginNoteSync(
              ownerId,
              `${ownerId}:${value.note.id}`,
              value.note,
              undefined,
              true,
            )
            router.replace(
              withBrowserWorkReturn(
                `/full/eton/${value.note.id}`,
                fromBrowserWork,
              ),
            )
          }
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
        href={returnPath}
      >
        {t(fromBrowserWork ? 'recovery.browserWorkTitle' : 'collections.all')}
      </Link>
    </main>
  )
}
