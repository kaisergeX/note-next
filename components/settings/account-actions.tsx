'use client'

import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react'
import {useLocale, useTranslations} from 'next-intl'
import {signOut} from 'next-auth/react'
import {unstable_rethrow} from 'next/navigation'
import {IconTrash, IconUserOff} from '@tabler/icons-react'
import Button from '~/components/ui/button'
import {Input} from '~/components/ui/input'
import {Link, useRouter} from '~/i18n/navigation'
import {
  beginAccountDeletionAction,
  getBulkTrashCountAction,
  moveAllNotesToTrashAction,
} from '~/app/[locale]/settings/account/actions'
import {hasFreshDeleteVerification} from '~/lib/account/policy'
import {
  clearDeletedAccountBrowserData,
  publishAccountDataEvent,
} from '~/lib/account/client-events'
import {usePersistStore} from '~/store'
import {useTrashRefresh} from '~/components/note/trash/use-trash-refresh'
import BaseConfirmationDialog from '~/components/ui/confirmation-dialog'

function ConfirmationDialog({
  open,
  title,
  description,
  busy,
  onClose,
  children,
}: {
  open: boolean
  title: string
  description: string
  busy: boolean
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()
  const descriptionId = useId()
  return (
    <BaseConfirmationDialog
      open={open}
      busy={busy}
      labelledBy={titleId}
      describedBy={descriptionId}
      onRequestClose={onClose}
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      <p id={descriptionId} className="text-ink-muted mt-3 text-sm">
        {description}
      </p>
      {children}
    </BaseConfirmationDialog>
  )
}

export default function AccountActions({
  ownerId,
  email,
  activeCount,
  trashCount,
  nextTrashExpiry,
  verifiedAt,
  serverNow,
  returning,
  verificationFailed,
}: {
  ownerId: string
  email: string
  activeCount: number
  trashCount: number
  nextTrashExpiry?: string
  verifiedAt?: number
  serverNow: number
  returning: boolean
  verificationFailed: boolean
}) {
  const t = useTranslations('user.settings.dataActions')
  const locale = useLocale()
  const router = useRouter()
  useTrashRefresh(serverNow, nextTrashExpiry ? [nextTrashExpiry] : [])
  const [dialog, setDialog] = useState<'trash' | 'delete' | null>(
    returning || verificationFailed ? 'delete' : null,
  )
  const [count, setCount] = useState(activeCount)
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string>()
  const [movedCount, setMovedCount] = useState<number>()
  const [pending, startTransition] = useTransition()
  const [now, setNow] = useState(serverNow)
  const busy = useRef(false)
  const emailId = useId()
  const emailHelpId = useId()
  const verified = hasFreshDeleteVerification(verifiedAt, now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const close = () => {
    if (busy.current) return
    setDialog(null)
    setError(undefined)
    setConfirmation('')
    if (returning || verificationFailed)
      router.replace('/settings/account', {scroll: false})
  }
  const run = (operation: () => Promise<void>, deleting = false) => {
    if (busy.current) return
    busy.current = true
    setError(undefined)
    startTransition(async () => {
      try {
        await operation()
      } catch (error) {
        unstable_rethrow(error)
        setError(
          t(
            deleting
              ? 'deleteUnconfirmed'
              : dialog === 'delete'
                ? 'verificationUnavailable'
                : 'actionFailed',
          ),
        )
      } finally {
        busy.current = false
      }
    })
  }
  const openTrash = () => {
    setError(undefined)
    setMovedCount(undefined)
    setDialog('trash')
    run(async () => {
      const result = await getBulkTrashCountAction(ownerId)
      if (result.status !== 'success') {
        setError(
          t(
            result.status === 'account_changed'
              ? 'accountChanged'
              : 'actionFailed',
          ),
        )
        return
      }
      setCount(result.count)
    })
  }
  const moveNotes = () =>
    run(async () => {
      const result = await moveAllNotesToTrashAction(ownerId)
      if (result.status !== 'success') {
        setError(
          t(
            result.status === 'account_changed'
              ? 'accountChanged'
              : 'actionFailed',
          ),
        )
        return
      }
      usePersistStore.getState().setMutateNoteData(undefined)
      publishAccountDataEvent({ownerId, type: 'notes-trashed'})
      setCount(0)
      setMovedCount(result.count)
      setDialog(null)
      router.refresh()
    })
  const deleteAccount = () =>
    run(async () => {
      const response = await fetch('/api/user/account', {
        method: 'DELETE',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: confirmation, ownerId}),
      })
      if (!response.ok) {
        const result = await response.json()
        setError(
          t(
            result.error === 'verification_required'
              ? 'verificationExpired'
              : result.error === 'account_changed'
                ? 'accountChanged'
                : 'deleteUnconfirmed',
          ),
        )
        if (result.error === 'verification_required') setNow(Date.now())
        return
      }
      clearDeletedAccountBrowserData(email)
      usePersistStore.getState().setMutateNoteData(undefined)
      publishAccountDataEvent({ownerId, type: 'account-deleted'})
      // Database deletion already invalidates every old session. Cookie cleanup is
      // best-effort; never present a committed deletion as a failure to delete.
      try {
        await signOut({redirect: false})
      } catch {
        /* Continue to confirmation. */
      }
      window.location.replace(`/${locale}/account-deleted`)
    }, true)

  const buttonClass = 'max-w-full whitespace-normal'
  return (
    <section aria-labelledby="account-actions-title" className="mt-8">
      <h3 id="account-actions-title">{t('title')}</h3>
      <div className="border-hairline mt-4 flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="font-medium">{t('trashTitle')}</h4>
          <p className="text-ink-muted mt-1 text-sm">{t('trashDescription')}</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
            <p className="text-ink-muted">
              {t('activeCount', {count: activeCount})}
            </p>
            <Link
              className="text-accent underline underline-offset-4"
              href="/trash"
            >
              {t('viewTrashCount', {count: trashCount})}
            </Link>
          </div>
          {movedCount !== undefined && (
            <p role="status" className="text-success mt-2 text-sm">
              {t('trashSuccess', {count: movedCount})}
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          className={`${buttonClass} shrink-0 self-start lg:max-w-xs`}
          disabled={pending || activeCount === 0}
          onClick={openTrash}
        >
          <IconTrash className="shrink-0" size={18} aria-hidden />
          {t('trashAction')}
        </Button>
      </div>
      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="font-medium">{t('deleteTitle')}</h4>
          <p className="text-ink-muted mt-1 text-sm">
            {t('deleteDescription')}
          </p>
        </div>
        <Button
          variant="danger"
          className={`${buttonClass} shrink-0 self-start lg:max-w-xs`}
          disabled={pending}
          onClick={() => {
            setError(undefined)
            setConfirmation('')
            setDialog('delete')
          }}
        >
          <IconUserOff className="shrink-0" size={18} aria-hidden />
          {t('deleteAction')}
        </Button>
      </div>
      <ConfirmationDialog
        open={dialog === 'trash'}
        title={t('trashConfirmTitle')}
        description={t('trashConfirmBody', {count})}
        busy={pending}
        onClose={close}
      >
        <p className="text-ink-muted mt-3 text-sm">{t('trashExisting')}</p>
        <p className="text-ink-muted mt-3 text-sm">{t('openViews')}</p>
        {error && (
          <p role="alert" className="text-destructive mt-4 text-sm">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            data-cancel
            variant="secondary"
            className={buttonClass}
            disabled={pending}
            onClick={close}
          >
            {t('cancel')}
          </Button>
          <Button
            className={buttonClass}
            loading={pending}
            disabled={count === 0 || !!error}
            onClick={moveNotes}
          >
            {t('trashAction')}
          </Button>
        </div>
        {error && (
          <Button
            variant="link"
            className={buttonClass}
            disabled={pending}
            onClick={openTrash}
          >
            {t('retry')}
          </Button>
        )}
      </ConfirmationDialog>
      <ConfirmationDialog
        open={dialog === 'delete'}
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirmBody')}
        busy={pending}
        onClose={close}
      >
        <p className="text-ink-muted mt-3 text-sm">{t('googleUnaffected')}</p>
        {!verified ? (
          <>
            <p className="mt-4 text-sm wrap-anywhere">
              {t.rich('verifyBody', {
                email,
                account: (chunks) => (
                  <strong className="bg-ink-tint text-ink rounded-sm box-decoration-clone px-1 font-semibold select-text">
                    {chunks}
                  </strong>
                ),
              })}
            </p>
            {verificationFailed && (
              <p role="alert" className="text-destructive mt-3 text-sm">
                {t('verificationFailed')}
              </p>
            )}
          </>
        ) : (
          <>
            <p role="status" className="text-success mt-4 text-sm">
              {t('verified')}
            </p>
            <label htmlFor={emailId} className="mt-4 block text-sm font-medium">
              {t('emailLabel')}
            </label>
            <p
              id={emailHelpId}
              className="bg-ink-tint text-ink mt-2 rounded-md px-3 py-2 text-sm font-semibold wrap-anywhere select-text"
            >
              {email}
            </p>
            <Input
              id={emailId}
              type="email"
              className="mt-2"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              aria-describedby={emailHelpId}
              autoComplete="off"
              spellCheck={false}
              disabled={pending}
            />
          </>
        )}
        {error && (
          <p role="alert" className="text-destructive mt-4 text-sm">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            data-cancel
            variant="secondary"
            className={buttonClass}
            disabled={pending}
            onClick={close}
          >
            {t('cancel')}
          </Button>
          {verified ? (
            <Button
              variant="danger"
              className={buttonClass}
              disabled={confirmation !== email}
              loading={pending}
              onClick={deleteAccount}
            >
              {t('deletePermanent')}
            </Button>
          ) : (
            <Button
              className={buttonClass}
              loading={pending}
              onClick={() =>
                run(async () => {
                  const result = await beginAccountDeletionAction(
                    locale,
                    ownerId,
                  )
                  if (result?.status === 'account_changed')
                    setError(t('accountChanged'))
                })
              }
            >
              {t('verifyGoogle')}
            </Button>
          )}
        </div>
      </ConfirmationDialog>
    </section>
  )
}
