'use client'

import {useId, useRef, useState, useTransition} from 'react'
import {useTranslations} from 'next-intl'
import {IconRestore, IconTrash} from '@tabler/icons-react'
import Button from '~/components/ui/button'
import ConfirmationDialog from '~/components/ui/confirmation-dialog'
import {
  restoreNoteAction,
  permanentlyDeleteNoteAction,
} from '~/app/[locale]/(note)/eton/actions'
import {useRouter} from '~/i18n/navigation'
import {performNoteMutation} from '~/lib/notes/client-mutation'
import {noteMutationSucceeded} from '~/lib/notes/lifecycle'
import type {TrashItem} from '~/lib/notes/text'

export default function TrashActions({
  item,
  disabled,
  compact = false,
  onComplete,
  onBusyChange,
}: {
  item: TrashItem
  disabled?: boolean
  compact?: boolean
  onComplete: () => void
  onBusyChange?: (busy: boolean) => void
}) {
  const t = useTranslations('note.trash')
  const router = useRouter()
  const busy = useRef(false)
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string>()
  const labelId = useId()
  const descriptionId = useId()
  const title = item.title || t('untitled')
  const close = () => {
    setConfirming(false)
  }
  const run = (remove: boolean) => {
    if (busy.current || disabled || !navigator.onLine) return
    busy.current = true
    onBusyChange?.(true)
    setError(undefined)
    startTransition(async () => {
      try {
        const result = await performNoteMutation(() =>
          remove
            ? permanentlyDeleteNoteAction(item.id, item.deadlineToken)
            : restoreNoteAction(item.id, item.deadlineToken),
        )
        if (!noteMutationSucceeded(result)) {
          setError(
            result.status === 'conflict' || result.status === 'unavailable'
              ? t('changed')
              : t('actionFailed'),
          )
          if (result.status === 'conflict' || result.status === 'unavailable')
            router.refresh()
          return
        }
        close()
        onComplete()
      } finally {
        busy.current = false
        onBusyChange?.(false)
      }
    })
  }
  return (
    <div className={compact ? 'shrink-0' : undefined}>
      <div className={compact ? 'flex gap-2' : 'flex flex-wrap gap-2'}>
        <Button
          variant={compact ? 'ghost' : 'secondary'}
          size={compact ? 'sm' : 'md'}
          iconOnly={compact}
          disabled={pending || disabled}
          loading={pending && !confirming}
          onClick={() => run(false)}
          aria-label={t('restoreNamed', {title})}
          title={compact ? t('restore') : undefined}
        >
          {compact
            ? (!pending || confirming) && (
                <IconRestore size="1rem" aria-hidden />
              )
            : t('restore')}
        </Button>
        <Button
          variant="danger"
          size={compact ? 'sm' : 'md'}
          iconOnly={compact}
          className={compact ? 'border-transparent' : undefined}
          disabled={pending || disabled}
          onClick={() => {
            setError(undefined)
            setConfirming(true)
          }}
          aria-label={t('deleteNamed', {title})}
          title={compact ? t('delete') : undefined}
        >
          {compact ? <IconTrash size="1rem" aria-hidden /> : t('delete')}
        </Button>
      </div>
      {error && !confirming && (
        <p role="alert" className="text-destructive mt-2 text-sm">
          {error}
        </p>
      )}
      <ConfirmationDialog
        open={confirming}
        busy={pending}
        labelledBy={labelId}
        describedBy={descriptionId}
        onRequestClose={close}
        className="max-w-md p-4"
      >
        <h2 id={labelId} className="text-lg font-semibold">
          {t('confirmTitle')}
        </h2>
        <p
          id={descriptionId}
          className="text-ink-muted mt-3 text-sm wrap-anywhere"
        >
          {t('confirmBody', {title})}
        </p>
        {error && (
          <p role="alert" className="text-destructive mt-3 text-sm">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button
            data-cancel
            variant="secondary"
            disabled={pending}
            onClick={close}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="danger"
            loading={pending}
            disabled={disabled || pending}
            onClick={() => run(true)}
          >
            {t('delete')}
          </Button>
        </div>
      </ConfirmationDialog>
    </div>
  )
}
