'use client'

import {useId, useRef, useState, useTransition} from 'react'
import {useLocale, useTranslations} from 'next-intl'
import {unstable_rethrow} from 'next/navigation'
import {IconRestore, IconTrash} from '@tabler/icons-react'
import Button from '~/components/ui/button'
import ConfirmationDialog from '~/components/ui/confirmation-dialog'
import {Input} from '~/components/ui/input'
import CollectionTitle from '~/components/note/collection-title'
import {
  previewTrashAction,
  restoreAllTrashAction,
  emptyTrashAction,
} from '~/app/[locale]/(note)/collection/trash/actions'
import {EMPTY_TRASH_PHRASES, type TrashPreview} from '~/lib/notes/trash-bulk'
import {publishAccountDataEvent} from '~/lib/account/client-events'

type Mode = 'restore' | 'empty'

export default function TrashBulkActions({
  ownerId,
  count,
  online,
  onComplete,
}: {
  ownerId: string
  count: number
  online: boolean
  onComplete: () => void
}) {
  const t = useTranslations('note.trash.bulk')
  const tCollections = useTranslations('note.collections')
  const locale = useLocale()
  const phrase = EMPTY_TRASH_PHRASES[locale]
  const [mode, setMode] = useState<Mode>('restore')
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<TrashPreview>()
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string>()
  const [pending, startTransition] = useTransition()
  const [preparing, setPreparing] = useState(false)
  const working = pending || preparing
  const busy = useRef(false)
  const titleId = useId()
  const bodyId = useId()
  const inputId = useId()
  const phraseId = useId()
  const countId = useId()

  const close = () => {
    if (busy.current) return
    setOpen(false)
  }
  const run = (operation: () => Promise<void>, animate = true) => {
    if (busy.current || !online || !navigator.onLine) return
    busy.current = true
    setError(undefined)
    const execute = async () => {
      try {
        await operation()
      } catch (error) {
        unstable_rethrow(error)
        setError(t('failed'))
      } finally {
        busy.current = false
        if (!animate) setPreparing(false)
      }
    }
    if (animate) startTransition(execute)
    else {
      // Previewing a modal is not a page mutation. Urgent updates avoid
      // cross-fading the native dialog's top layer while it is opening.
      setPreparing(true)
      void execute()
    }
  }
  const prepare = (nextMode: Mode) => {
    setMode(nextMode)
    setOpen(true)
    setPreview(undefined)
    setConfirmation('')
    run(async () => {
      const result = await previewTrashAction(ownerId)
      if (result.status !== 'success') {
        setError(
          t(result.status === 'account_changed' ? 'accountChanged' : 'failed'),
        )
        return
      }
      setPreview({count: result.count, snapshot: result.snapshot})
    }, false)
  }
  const submit = () => {
    if (!open || !preview || !preview.count) return
    const operation = mode
    run(async () => {
      const result =
        operation === 'restore'
          ? await restoreAllTrashAction(ownerId, preview.snapshot)
          : await emptyTrashAction(ownerId, preview.snapshot, confirmation)
      if (result.status !== 'success') {
        if (
          result.status === 'conflict' ||
          result.status === 'account_changed'
        ) {
          setPreview(undefined)
          setConfirmation('')
        }
        setError(
          t(
            result.status === 'conflict'
              ? 'changed'
              : result.status === 'account_changed'
                ? 'accountChanged'
                : 'failed',
          ),
        )
        return
      }
      setOpen(false)
      publishAccountDataEvent({ownerId, type: 'trash-updated'})
      onComplete()
    })
  }
  const buttonClass = 'max-w-full whitespace-normal'
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CollectionTitle
          title={tCollections('deleted')}
          count={count}
          countLabel={t('count', {count})}
          countId={countId}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className={buttonClass}
            disabled={!count || !online || working}
            onClick={() => prepare('restore')}
          >
            <IconRestore size={18} className="shrink-0" aria-hidden />
            {t('restore')}
          </Button>
          <Button
            variant="danger"
            className={buttonClass}
            disabled={!count || !online || working}
            onClick={() => prepare('empty')}
          >
            <IconTrash size={18} className="shrink-0" aria-hidden />
            {t('empty')}
          </Button>
        </div>
      </div>
      <ConfirmationDialog
        open={open}
        busy={working}
        labelledBy={titleId}
        describedBy={bodyId}
        restoreFocusId={countId}
        onRequestClose={close}
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {t(mode === 'empty' ? 'emptyTitle' : 'restoreTitle')}
        </h2>
        <p id={bodyId} className="text-ink-muted mt-3 text-sm">
          {t(mode === 'empty' ? 'emptyBody' : 'restoreBody', {
            count: preview?.count ?? count,
          })}
        </p>
        <span role="status" className="sr-only">
          {preparing ? t('preparing') : ''}
        </span>
        <p className="text-ink-muted mt-3 text-sm">{t('scope')}</p>
        {mode === 'empty' && (preview?.count ?? count) > 0 && (
          <>
            <label htmlFor={inputId} className="mt-4 block text-sm font-medium">
              {t('phraseLabel')}
            </label>
            <p
              id={phraseId}
              className="bg-ink-tint text-ink mt-2 rounded-md px-3 py-2 text-sm font-semibold wrap-anywhere select-text"
            >
              {phrase}
            </p>
            <Input
              id={inputId}
              className="mt-2"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              aria-describedby={phraseId}
              autoComplete="off"
              spellCheck={false}
              disabled={working}
            />
          </>
        )}
        {!online && (
          <p role="alert" className="text-destructive mt-4 text-sm">
            {t('offline')}
          </p>
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
            disabled={working}
            onClick={close}
          >
            {t('cancel')}
          </Button>
          <Button
            variant={mode === 'empty' ? 'danger' : 'primary'}
            className={buttonClass}
            loading={pending}
            disabled={
              !online ||
              working ||
              !preview?.count ||
              (mode === 'empty' && confirmation !== phrase)
            }
            onClick={submit}
          >
            {t(mode === 'empty' ? 'emptyConfirm' : 'restore')}
          </Button>
        </div>
        {error && (
          <Button
            variant="link"
            className={`${buttonClass} mt-2`}
            disabled={!online || working}
            onClick={() => {
              if (mode) prepare(mode)
            }}
          >
            {t('refresh')}
          </Button>
        )}
      </ConfirmationDialog>
    </>
  )
}
