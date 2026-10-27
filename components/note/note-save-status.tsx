'use client'

import {
  IconCloudCheck,
  IconCloudUp,
  IconCloud,
  IconDeviceDesktop,
  IconDeviceDesktopCheck,
  IconCircleX,
  IconAlertTriangle,
  IconLoader2,
  IconTrash,
} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {usePersistStore} from '~/store'
import PopoverBase from '~/components/ui/popover'
import {buttonClass} from '~/components/ui/button'
import {cn} from 'cn'

export default function NoteSaveStatus({
  dirty,
  error,
  creating,
}: {
  dirty: boolean
  error?: boolean
  creating: boolean
}) {
  const t = useTranslations('note.recovery')
  const session = usePersistStore((state) => state.noteSession)
  const checkpoint = session?.localGeneration !== undefined
  const current = checkpoint && session.localGeneration === session.generation
  const localFailed = Boolean(session?.storageFailed)
  const serverFailed = Boolean(
    error ||
    [
      'local',
      'failed',
      'unauthenticated',
      'invalid_input',
      'account_changed',
    ].includes(session?.syncStatus ?? ''),
  )
  const conflict = session?.syncStatus === 'conflict'
  const unavailable = session?.syncStatus === 'unavailable'
  const moving = session?.operation === 'trash'
  const saving = session?.syncStatus === 'saving'
  const queued =
    dirty && !serverFailed && !conflict && !unavailable && !saving && !moving
  const danger = localFailed || serverFailed
  const warning = conflict || unavailable
  const localMessage = localFailed
    ? 'detailFailed'
    : !dirty
      ? 'detailNoDraft'
      : current
        ? 'detailSaved'
        : 'detailSaving'
  const serverMessage = moving
    ? 'detailMoving'
    : serverFailed
      ? 'detailFailed'
      : conflict
        ? 'detailReview'
        : unavailable
          ? 'detailUnavailable'
          : saving
            ? 'detailSyncing'
            : dirty
              ? 'detailQueued'
              : creating
                ? 'detailNotSaved'
                : 'detailSaved'
  const LocalIcon = localFailed
    ? IconCircleX
    : current
      ? IconDeviceDesktopCheck
      : IconDeviceDesktop
  const ServerIcon = serverFailed
    ? IconCircleX
    : warning
      ? IconAlertTriangle
      : moving
        ? IconTrash
        : saving
          ? IconLoader2
          : queued
            ? IconCloudUp
            : creating
              ? IconCloud
              : IconCloudCheck
  const StatusIcon = danger
    ? IconCircleX
    : warning
      ? IconAlertTriangle
      : ServerIcon
  const localLabel = `${t('detailDevice')}: ${t(localMessage)}`
  const serverLabel = `${t('detailSync')}: ${t(serverMessage)}`
  return (
    <PopoverBase
      anchor="top-end"
      trigger={
        <StatusIcon
          size={18}
          aria-hidden
          className={cn(
            !danger &&
              !warning &&
              saving &&
              'animate-spin motion-reduce:animate-none',
            !danger &&
              !warning &&
              queued &&
              'animate-pulse motion-reduce:animate-none',
          )}
        />
      }
      triggerAriaLabel={`${localLabel}. ${serverLabel}`}
      triggerClassName={cn(
        buttonClass({variant: 'ghost', iconOnly: true}),
        danger
          ? 'text-destructive'
          : warning
            ? 'text-warning'
            : 'text-ink-muted',
      )}
      className="border-hairline bg-paper-raised text-ink shadow-sheet rounded-lg border px-3 py-2 text-xs"
    >
      <div className="grid grid-cols-[auto_auto_1fr] items-center gap-x-2 gap-y-2">
        <LocalIcon
          size={16}
          aria-hidden
          className={
            localFailed
              ? 'text-destructive'
              : current
                ? 'text-success'
                : 'text-ink-muted'
          }
        />
        <span className="text-ink-muted">{t('detailDevice')}</span>
        <span className={localFailed ? 'text-destructive' : ''}>
          {t(localMessage)}
        </span>
        <ServerIcon
          size={16}
          aria-hidden
          className={cn(
            serverFailed
              ? 'text-destructive'
              : warning
                ? 'text-warning'
                : 'text-ink-muted',
            saving && 'animate-spin motion-reduce:animate-none',
          )}
        />
        <span className="text-ink-muted">{t('detailSync')}</span>
        <span className={serverFailed ? 'text-destructive' : ''}>
          {t(serverMessage)}
        </span>
      </div>
    </PopoverBase>
  )
}
