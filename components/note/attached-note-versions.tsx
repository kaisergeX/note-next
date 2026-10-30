'use client'

import {useState, type ReactNode} from 'react'
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
  children,
}: {
  className?: string
  children?: (action: ReactNode, choosing: boolean) => ReactNode
}) {
  const {data: auth} = useSession()
  const ownerId = auth?.user?.id ?? ''
  const {records} = useRecoveryDrafts(ownerId, true)
  const session = usePersistStore((state) => state.noteSession)
  const [review, setReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const t = useTranslations('note.recovery')
  const active = getNoteSync()
  const current = active?.record.ownerId === ownerId ? active : undefined
  const related = current
    ? records.filter(
        (row) =>
          recoveryNoteId(row) === recoveryNoteId(current.record) &&
          row.id !== current.record.id &&
          !sameRecoveryCopy(row, current.record),
      )
    : []
  const choose = async (record?: RecoveryDraft, discarded = false) => {
    if (!current || (!discarded && getNoteSync() !== current)) return
    setBusy(true)
    try {
      if (
        !discarded &&
        current.dirty &&
        (!(await current.persist()) || !current.localSafe)
      ) {
        // Keep the active editor and its storage-failure/export guidance visible
        // if the outgoing version cannot be durably handed off.
        setReview(false)
        return
      }
      setReview(false)
      const url = new URL(window.location.href)
      if (record?.versionId) url.searchParams.set('version', record.versionId)
      else if (current.record.versionId || related.some((row) => row.versionId))
        url.searchParams.set('version', 'saved')
      else url.searchParams.delete('version')
      window.history.replaceState(null, '', url.href)
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
  const action =
    related.length > 0 ? (
      <div
        className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}
      >
        <Button
          className="h-auto min-h-10 max-w-full whitespace-normal"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => setReview(true)}
        >
          {t('reviewVersions')}
        </Button>
      </div>
    ) : null
  const choosing = review && related.length > 0
  return (
    <>
      {children ? children(action, choosing) : action}
      <NoteVersionPicker
        open={choosing}
        dismissLabel="closeComparison"
        busy={busy}
        note={
          current && !current.record.unavailable && current.record.baseline.id
            ? (current.record.baseline as Note)
            : undefined
        }
        records={current ? [current.record, ...related] : []}
        onDiscard={(record) => {
          if (current && record.id === current.record.id)
            void choose(
              related.find(
                (row) => row.versionId === current.record.editedCopyOf,
              ),
              true,
            )
        }}
        onClose={() => setReview(false)}
        onChoose={(record) => void choose(record)}
      />
    </>
  )
}
