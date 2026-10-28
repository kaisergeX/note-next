'use client'

import {useEffect, useId, useState} from 'react'
import {useSession} from 'next-auth/react'
import {useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {IconX} from '@tabler/icons-react'
import {Dialog} from '@kaiverse/k/ui'
import {Link} from '~/i18n/navigation'
import {useWindowEvent} from '~/util/hooks/use-window-event'
import Button, {buttonClass} from '~/components/ui/button'
import {exportDrafts} from '~/lib/notes/drafts'
import ConfirmationDialog from '~/components/ui/confirmation-dialog'
import {
  flushVisibleDrafts,
  getNoteSync,
  hasUnsafeDraft,
  persistCurrentDraft,
  removeAccountRecovery,
  setNoteSyncAccount,
} from '~/lib/notes/session-sync'

type ExitRequest = {ownerId: string; resolve: (allowed: boolean) => void}
export default function NotePersistence() {
  const {data: session, status} = useSession()
  const ownerId = session?.user?.id
  const router = useRouter()
  const t = useTranslations('note.recovery')
  const [exit, setExit] = useState<ExitRequest>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [discard, setDiscard] = useState(false)
  const titleId = useId(),
    descriptionId = useId()
  const activeTitleId = discard ? `${titleId}-discard` : titleId
  useEffect(() => {
    if (status !== 'loading') setNoteSyncAccount(ownerId)
  }, [ownerId, status])
  useWindowEvent('online', () => {
    void flushVisibleDrafts()
  })
  useWindowEvent('beforeunload', (rawEvent) => {
    const event = rawEvent as BeforeUnloadEvent
    if (hasUnsafeDraft()) {
      void persistCurrentDraft()
      event.preventDefault()
      event.returnValue = ''
    }
  })
  useWindowEvent('note-list-stale', () => router.refresh())
  useWindowEvent('note-account-exit', (event) => {
    setExit((event as CustomEvent<ExitRequest>).detail)
    setError(false)
    setDiscard(false)
  })
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === 'hidden') {
        void persistCurrentDraft()
        void getNoteSync()?.flush()
      } else void getNoteSync()?.refreshRemote()
    }
    let replaying = false
    const navigation = (event: MouseEvent) => {
      if (
        replaying ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const anchor = (event.target as Element).closest<HTMLAnchorElement>(
        'a[href]',
      )
      if (
        !anchor ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        !hasUnsafeDraft()
      )
        return
      event.preventDefault()
      void persistCurrentDraft().then((safe) => {
        if (!safe || hasUnsafeDraft()) {
          getNoteSync()?.retry()
          return
        }
        replaying = true
        anchor.click()
        replaying = false
      })
    }
    document.addEventListener('visibilitychange', hidden)
    document.addEventListener('click', navigation, true)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      document.removeEventListener('click', navigation, true)
    }
  }, [])
  const finish = (allowed: boolean) => {
    exit?.resolve(allowed)
    setExit(undefined)
    setError(false)
    setDiscard(false)
  }
  const keepAndContinue = async () => {
    if (!exit) return
    setBusy(true)
    try {
      if (!(await persistCurrentDraft()) || hasUnsafeDraft()) {
        setError(true)
        return
      }
      finish(true)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <ConfirmationDialog
      open={!!exit}
      busy={busy}
      labelledBy={activeTitleId}
      initialFocusId={activeTitleId}
      describedBy={descriptionId}
      onRequestClose={() => finish(false)}
      className="p-0"
    >
      <Dialog.Header>
        <Dialog.Title
          id={activeTitleId}
          tabIndex={-1}
          className="text-base font-semibold"
        >
          {t(discard ? 'exitDiscardTitle' : 'exitTitle')}
        </Dialog.Title>
        <Button
          variant="ghost"
          iconOnly
          data-cancel
          disabled={busy}
          aria-label={t('cancel')}
          onClick={() => finish(false)}
        >
          <IconX size={18} aria-hidden />
        </Button>
      </Dialog.Header>
      <Dialog.Content className="pt-0 text-sm">
        <p id={descriptionId} className="text-ink-muted">
          {t(discard ? 'exitDiscardBody' : 'exitDescription')}
        </p>
        {!discard && (
          <p className="text-ink-muted mt-2 text-xs">{t('exitRetention')}</p>
        )}
        {error && (
          <div className="text-destructive mt-3 text-sm" role="alert">
            <p>{t(discard ? 'recoveryFailed' : 'storageFailed')}</p>
            <Button
              variant="link"
              onClick={() => {
                const current = getNoteSync()
                if (current) exportDrafts([current.record])
              }}
            >
              {t('export')}
            </Button>
          </div>
        )}
      </Dialog.Content>
      <Dialog.Footer className="flex-col items-stretch gap-2 pt-0 sm:flex-row-reverse sm:items-center sm:justify-start">
        {discard ? (
          <>
            <Button
              variant="danger"
              loading={busy}
              className="h-auto min-h-10 whitespace-normal"
              onClick={async () => {
                if (!exit) return
                setBusy(true)
                try {
                  await removeAccountRecovery(exit.ownerId)
                  finish(true)
                } catch {
                  setError(true)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {t('exitDiscardConfirm')}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setDiscard(false)
                setError(false)
              }}
            >
              {t('cancel')}
            </Button>
          </>
        ) : (
          <>
            <Link
              href="/eton#browser-work"
              className={buttonClass({variant: 'primary'})}
              aria-disabled={busy || undefined}
              onClick={(event) => {
                if (busy) event.preventDefault()
                else finish(false)
              }}
            >
              {t('reviewNoteDrafts')}
            </Link>
            <Button
              variant="secondary"
              disabled={busy}
              loading={busy}
              className="h-auto min-h-10 whitespace-normal"
              onClick={() => void keepAndContinue()}
            >
              {t('keepOnDevice')}
            </Button>
            <Button
              variant="danger"
              className="sm:mr-auto"
              disabled={busy}
              onClick={() => {
                setDiscard(true)
                setError(false)
              }}
            >
              {t('exitDiscard')}
            </Button>
          </>
        )}
      </Dialog.Footer>
    </ConfirmationDialog>
  )
}
