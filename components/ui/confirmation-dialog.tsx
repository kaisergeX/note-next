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
  className,
  children,
}: {
  open: boolean
  busy: boolean
  onRequestClose: () => void
  labelledBy: string
  describedBy: string
  restoreFocusId?: string
  className?: string
  children: ReactNode
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const previousFocus = useRef<Element | null>(null)

  // Capture the trigger before the library's passive effect opens the modal.
  useLayoutEffect(() => {
    if (open) previousFocus.current = document.activeElement
  }, [open])
  useEffect(() => {
    if (open)
      dialog.current
        ?.querySelector<HTMLButtonElement>('[data-cancel]:not(:disabled)')
        ?.focus()
  }, [open])
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
        if (event.key !== 'Escape') return
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
        'bg-paper-raised text-ink border-hairline shadow-sheet backdrop:bg-paper/50 m-auto max-h-full w-full max-w-lg overflow-y-auto rounded-lg border p-6 backdrop:backdrop-blur max-sm:mx-3 max-sm:w-auto',
        className,
      )}
    >
      {children}
    </Dialog>
  )
}
