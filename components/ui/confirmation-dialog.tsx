'use client'

import {Dialog} from '@kaiverse/k/ui'
import {useEffect, useLayoutEffect, useRef, type ReactNode} from 'react'
import {cn} from 'cn'

/** App confirmation policy; visibility and motion belong to the library Dialog. */
export default function ConfirmationDialog({
  open,
  busy,
  onRequestClose,
  labelledBy,
  describedBy,
  restoreFocusId,
  initialFocusId,
  className,
  layout = 'confirmation',
  children,
}: {
  open: boolean
  busy: boolean
  onRequestClose: () => void
  labelledBy: string
  describedBy: string
  restoreFocusId?: string
  initialFocusId?: string
  className?: string
  layout?: 'confirmation' | 'workspace' | 'comparison'
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const previousFocus = useRef<Element | null>(null)

  // Capture the trigger before the library's passive effect opens the modal.
  useLayoutEffect(() => {
    if (open) previousFocus.current = document.activeElement
  }, [open])
  useEffect(() => {
    if (!open) return
    const initial = initialFocusId
      ? document.getElementById(initialFocusId)
      : dialog.current?.querySelector<HTMLButtonElement>(
          '[data-cancel]:not(:disabled)',
        )
    initial?.focus()
  }, [open, initialFocusId])
  useLayoutEffect(() => {
    const element = dialog.current
    // Cached routes can hide mounted DOM; remove it from the native top layer.
    return () => element?.close()
  }, [])

  return (
    <Dialog
      ref={dialog}
      open={open}
      preventClose
      aria-busy={busy}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onKeyDownCapture={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('dialog') !== event.currentTarget
        )
          return
        if (event.key !== 'Escape') return
        if (event.currentTarget.querySelector(':popover-open')) return
        event.preventDefault()
        if (!busy) onRequestClose()
      }}
      onClose={() => {
        const previous = previousFocus.current
        if (
          previous instanceof HTMLElement &&
          previous.isConnected &&
          !previous.matches(':disabled')
        )
          previous.focus()
        else if (restoreFocusId)
          document.getElementById(restoreFocusId)?.focus()
      }}
      className={cn(
        'bg-paper-raised text-ink border-hairline shadow-sheet backdrop:bg-paper/50 backdrop:backdrop-blur',
        layout === 'comparison'
          ? 'm-auto h-dvh max-h-dvh w-dvw max-w-none flex-col overflow-hidden rounded-none border-0 p-0 open:flex sm:h-5/6 sm:w-11/12 sm:max-w-6xl sm:rounded-lg sm:border'
          : layout === 'workspace'
            ? 'm-auto h-dvh max-h-dvh w-dvw max-w-none flex-col overflow-hidden rounded-none border-0 p-0 open:flex sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100dvw-2rem)] sm:max-w-none sm:rounded-lg sm:border'
            : 'm-auto max-h-full w-full max-w-lg overflow-y-auto rounded-lg border p-6 max-sm:mx-3 max-sm:w-auto',
        className,
      )}
    >
      {children}
    </Dialog>
  )
}
