'use client'

import {useState} from 'react'
import {cn} from 'cn'
import {useTranslations} from 'next-intl'
import {useSession} from 'next-auth/react'
import type {Note} from '~/db/schema/notes'
import type {RecoveryDraft} from '~/lib/notes/drafts'
import {useRecoveryDrafts} from '~/lib/notes/use-recovery-drafts'
import {recoveryNoteId, sameRecoveryCopy} from '~/lib/notes/recovery-copies'
import {beginNoteSync, getNoteSync} from '~/lib/notes/session-sync'
import {usePersistStore} from '~/store'
import Button from '~/components/ui/button'
import NoteVersionPicker from './note-version-picker'

export default function AttachedNoteVersions({
  className,
}: {
  className?: string
}) {
  const {data: auth} = useSession()
  const ownerId = auth?.user?.id ?? ''
  const {records} = useRecoveryDrafts(ownerId, true)
  const session = usePersistStore((state) => state.noteSession)
  const [review, setReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const t = useTranslations('note.recovery')
  const current = getNoteSync()
  if (!current || current.record.ownerId !== ownerId) return null
  const related = records.filter(
    (row) =>
      recoveryNoteId(row) === recoveryNoteId(current.record) &&
      row.id !== current.record.id &&
      !sameRecoveryCopy(row, current.record),
  )
  if (!related.length) return null
  const choose = async (record?: RecoveryDraft) => {
    setBusy(true)
    try {
      if (current.dirty && (!(await current.persist()) || !current.localSafe))
        return
      setReview(false)
      beginNoteSync(
        ownerId,
        session!.key,
        current.record.baseline.id
          ? (current.record.baseline as Note)
          : undefined,
        record,
        !record,
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}>
      <Button
        className="h-auto min-h-10 max-w-full whitespace-normal"
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => setReview(true)}
      >
        {t('reviewVersions')}
      </Button>
      {review && (
        <NoteVersionPicker
          busy={busy}
          note={
            !current.record.unavailable && current.record.baseline.id
              ? (current.record.baseline as Note)
              : undefined
          }
          records={related}
          onClose={() => setReview(false)}
          onChoose={(record) => void choose(record)}
        />
      )}
    </div>
  )
}
