'use client'

import {Dialog} from '@kaiverse/k/ui'
import {IconX} from '@tabler/icons-react'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {useTranslations} from 'next-intl'
import {unstable_rethrow} from 'next/navigation'
import {cn} from 'cn'
import Button from '~/components/ui/button'
import {Badge} from '~/components/ui/badge'
import type {TrashItem} from '~/lib/notes/text'
import type {LifecycleNote} from '~/lib/notes/lifecycle'
import {readTrashNoteAction} from '~/app/[locale]/(note)/collection/trash/actions'
import NoteReadOnly from './note-read-only'
import TrashActions from './trash-actions'
import ExpiryDate from './expiry-date'

export default function TrashPreviewDialog({
  item,
  ownerId,
  open,
  available,
  online,
  onClose,
  onComplete,
}: {
  item: TrashItem
  ownerId: string
  open: boolean
  available: boolean
  online: boolean
  onClose: () => void
  onComplete: () => void
}) {
  const t = useTranslations('note.trash')
  const titleId = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const previousFocus = useRef<Element | null>(null)
  const [note, setNote] = useState<LifecycleNote>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useLayoutEffect(() => {
    if (open) previousFocus.current = document.activeElement
  }, [open])
  useLayoutEffect(() => {
    const element = dialog.current
    return () => element?.close()
  }, [])
  useEffect(() => {
    if (!open) return
    let active = true
    async function load() {
      try {
        const result = await readTrashNoteAction(
          ownerId,
          item.id,
          item.deadlineToken,
        )
        if (!active) return
        if (result.status === 'success') setNote(result.note)
        else
          setError(
            t(
              result.status === 'account_changed'
                ? 'bulk.accountChanged'
                : result.status === 'unavailable'
                  ? 'changed'
                  : 'loadFailed',
            ),
          )
      } catch (error) {
        unstable_rethrow(error)
        if (active) setError(t('loadFailed'))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [open, ownerId, item.id, item.deadlineToken, attempt, t])

  const close = () => {
    if (!busy) onClose()
  }
  const theme = note?.theme ?? item.theme
  return (
    <Dialog
      ref={dialog}
      open={open}
      preventClose
      aria-labelledby={titleId}
      aria-busy={loading || busy}
      onKeyDownCapture={(event) => {
        // A permanent-delete confirmation has its own Escape handling.
        if (
          event.target instanceof Element &&
          event.target.closest('dialog') !== event.currentTarget
        )
          return
        if (event.key === 'Escape') {
          event.preventDefault()
          close()
        }
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close()
      }}
      onClose={() => {
        const previous = previousFocus.current
        if (previous instanceof HTMLElement && previous.isConnected)
          previous.focus()
        else document.querySelector<HTMLElement>('[data-trash-count]')?.focus()
      }}
      className={cn(
        'text-ink shadow-sheet backdrop:bg-paper/50 m-auto flex-col overflow-hidden rounded-lg backdrop:backdrop-blur open:flex max-sm:h-dvh max-sm:w-dvw max-sm:rounded-none sm:max-h-(--dialog-max-height) sm:w-3/4 sm:max-w-(--breakpoint-md)',
        theme ? `dialog-${theme} shadow-theme-${theme}` : 'bg-paper-raised',
      )}
      style={{'--dialog-max-height': 'calc(100dvh - 2rem)'} as CSSProperties}
    >
      <header className="flex shrink-0 items-start justify-between gap-3 p-4">
        <h2
          id={titleId}
          className="min-w-0 flex-1 font-serif text-xl font-semibold wrap-anywhere"
        >
          {item.title || t('untitled')}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          <Badge status="neutral" className="shrink-0">
            {t('readOnly')}
          </Badge>
          <Button
            variant="ghost"
            iconOnly
            className="shrink-0"
            disabled={busy}
            aria-label={t('closePreview')}
            onClick={close}
          >
            <IconX size={20} aria-hidden />
          </Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {!online && (
          <p role="status" className="text-ink-muted mb-3 text-sm">
            {t('offline')}
          </p>
        )}
        {!available ? (
          <p role="status" className="text-ink-muted">
            {t('changed')}
          </p>
        ) : loading ? (
          <p role="status" className="text-ink-muted py-6 text-sm">
            {t('loading')}
          </p>
        ) : error ? (
          <div className="space-y-3">
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
            <Button
              variant="secondary"
              disabled={!online}
              onClick={() => {
                setNote(undefined)
                setError(undefined)
                setLoading(true)
                setAttempt((value) => value + 1)
              }}
            >
              {t('retry')}
            </Button>
          </div>
        ) : note ? (
          <NoteReadOnly content={note.content} theme={note.theme} />
        ) : null}
      </div>
      {available && note && !loading && !error && (
        <footer className="border-hairline flex shrink-0 flex-wrap items-center justify-between gap-3 border-t p-4">
          <p className="text-ink-muted text-xs">
            <ExpiryDate deadline={item.deadlineToken} />
          </p>
          <TrashActions
            item={item}
            disabled={!online}
            onBusyChange={setBusy}
            onComplete={onComplete}
          />
        </footer>
      )}
    </Dialog>
  )
}
