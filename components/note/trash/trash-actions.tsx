'use client'

import {useId, useRef, useState, useTransition} from 'react'
import {useTranslations} from 'next-intl'
import Button from '~/components/ui/button'
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
  onComplete,
}: {
  item: TrashItem
  disabled?: boolean
  onComplete: () => void
}) {
  const t = useTranslations('note.trash')
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const busy = useRef(false)
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string>()
  const labelId = useId()
  const descriptionId = useId()
  const title = item.title || t('untitled')
  const close = () => {
    setConfirming(false)
    dialog.current?.close()
    trigger.current?.focus()
  }
  const run = (remove: boolean) => {
    if (busy.current || disabled || !navigator.onLine) return
    busy.current = true
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
      }
    })
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={pending || disabled}
          loading={pending && !confirming}
          onClick={() => run(false)}
          aria-label={t('restoreNamed', {title})}
        >
          {t('restore')}
        </Button>
        <Button
          ref={trigger}
          variant="ghost"
          disabled={pending || disabled}
          onClick={() => {
            setError(undefined)
            setConfirming(true)
            dialog.current?.showModal()
            cancel.current?.focus()
          }}
          aria-label={t('deleteNamed', {title})}
        >
          {t('delete')}
        </Button>
      </div>
      {error && !confirming && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        onCancel={(event) => {
          if (pending) event.preventDefault()
          else setConfirming(false)
        }}
        className="bg-paper-raised text-ink border-hairline shadow-sheet backdrop:bg-paper/50 m-auto w-full max-w-md rounded-lg border p-4 backdrop:backdrop-blur"
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
            ref={cancel}
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
      </dialog>
    </div>
  )
}
