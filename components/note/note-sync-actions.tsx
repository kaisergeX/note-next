'use client'

import {useTranslations} from 'next-intl'
import type {NoteStoreState} from '~/types/note'
import Button from '~/components/ui/button'

type Session = NoteStoreState['noteSession']

export default function NoteSyncActions({
  session,
  disabled,
  hasVersions,
  onReview,
  onVersions,
  onRetry,
  onRecover,
  onExport,
}: {
  session?: Session
  disabled: boolean
  hasVersions: boolean
  onReview: () => void
  onVersions: () => void
  onRetry: () => void
  onRecover: () => void
  onExport: () => void
}) {
  const t = useTranslations('note.recovery')
  const status = session?.syncStatus
  const conflict = Boolean(session?.conflict)
  const unavailable = status === 'unavailable'
  const failed =
    status === 'failed' ||
    status === 'unauthenticated' ||
    status === 'invalid_input' ||
    status === 'account_changed'
  const retryable = failed || status === 'local'
  const exportable =
    conflict || unavailable || session?.storageFailed || retryable
  const actionClass = 'h-auto min-h-10 max-w-full whitespace-normal'
  if (!exportable && !hasVersions) return null

  return (
    <div className="flex flex-col gap-2">
      {session?.storageFailed && (
        <p className="text-destructive text-sm" role="alert">
          {t('storageFailed')}
        </p>
      )}
      {failed && (
        <p className="text-destructive text-sm" role="alert">
          {t(status)}
        </p>
      )}
      {unavailable && (
        <p className="text-warning text-sm" role="alert">
          {t('unavailable')}
        </p>
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {conflict && (
          <Button
            className={actionClass}
            size="sm"
            disabled={disabled}
            onClick={onReview}
          >
            {t('review')}
          </Button>
        )}
        {unavailable && (
          <Button
            className={actionClass}
            size="sm"
            disabled={disabled}
            onClick={onRecover}
          >
            {t('recoverNew')}
          </Button>
        )}
        {(retryable || session?.storageFailed) && !conflict && (
          <Button
            className={actionClass}
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={onRetry}
          >
            {t('retry')}
          </Button>
        )}
        {hasVersions && (
          <Button
            className={actionClass}
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={onVersions}
          >
            {t('reviewVersions')}
          </Button>
        )}
        {exportable && (
          <Button
            className={actionClass}
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={onExport}
          >
            {t('export')}
          </Button>
        )}
      </div>
    </div>
  )
}
