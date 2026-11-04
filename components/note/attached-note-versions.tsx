'use client'

import type {RecoveryDraft} from '~/lib/notes/drafts'
import {recoveryNoteId, sameRecoveryCopy} from '~/lib/notes/recovery-copies'
import {useRecoveryDrafts} from '~/lib/notes/use-recovery-drafts'

export default function useAttachedNoteVersions(current?: RecoveryDraft) {
  const {records, error} = useRecoveryDrafts(current?.ownerId ?? '', true)
  const related = current
    ? records.filter(
        (row) =>
          recoveryNoteId(row) === recoveryNoteId(current) &&
          row.id !== current.id &&
          !sameRecoveryCopy(row, current),
      )
    : []
  return {related, error}
}
