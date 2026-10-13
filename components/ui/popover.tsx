'use client'

/**
 * Native Popover API primitive: owns behavior only. Visuals live in the
 * callers (`triggerClassName` / `popoverClassName`).
 *
 * The trigger <button> uses the Invoker Commands API (`commandfor`/`command`)
 * instead of `popovertarget` on modern browsers, because the invoker gets
 * focus restored to it when the popover closes. `popoverTarget`/
 * `popoverTargetAction` are set as well for browsers with the Popover API but
 * without invoker commands (Safari ≤18.x, Firefox 125–146); per spec
 * `commandfor` takes precedence when both are present, so modern browsers are
 * unaffected — and a popovertarget invoker is exempt from light dismiss, so
 * its click never hides-then-reshows the popover.
 * Chrome does not expose implicit `aria-expanded` on `commandfor` buttons, so
 * it is tracked via React `onToggle` and set explicitly below.
 * The invoker button is also the *implicit anchor element* of its popover, so
 * no `position-anchor` CSS is needed.
 *
 * `popover="auto"` light-dismiss handles outside clicks natively.
 *
 * Engines without CSS anchor positioning (old Safari, Firefox < 147) fall back
 * to JS positioning — see the useEffects below. The `menu-no-anchor` class is
 * owned via React state (`noAnchor`) there, because an imperatively added
 * class would be wiped whenever React re-renders `className`.
 *
 * Engines without the Popover API itself (Chrome <114, Safari <17, Firefox
 * <125) get no popover at all: `@supports not selector(:popover-open)` in
 * globals.css keeps the popover permanently hidden there.
 */

import {classNames} from '@kaiverse/k/utils'
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
  type ToggleEvent,
} from 'react'

export type PopoverAnchor =
  'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'

export type PopoverBaseProps = {
  /** Popover position relative to the trigger button (its implicit anchor). */
  anchor?: PopoverAnchor
  /** Content of the trigger button. */
  trigger: ReactNode
  triggerClassName?: string
  /** Extra classes on the popover div — visuals live here, in the callers. */
  popoverClassName?: string
  disabled?: boolean
  /** A click on an enabled `a`/`button` inside the popover closes it. */
  closeOnSelect?: boolean
  onToggle?: (open: boolean) => void
  /** Explicit popover id; defaults to a sanitized `useId()`. */
  id?: string
  children: ReactNode
}

/**
 * React 19.1+ can emit non-ASCII ids like `«r0»` (and older versions used
 * `:r1:`) — neither is valid in CSS id selectors. Colons are fine in
 * `commandfor` IDREFs, but strip everything outside `[a-zA-Z0-9_-]` so
 * `CSS.escape` / querySelector use stays simple and ids are class-name safe.
 */
const safeId = (raw: string) => raw.replace(/[^a-zA-Z0-9_-]/g, '')

const ANCHOR_CLASSES: Record<PopoverAnchor, string> = {
  'bottom-end':
    '[position-area:block-end_span-inline-start] [justify-self:end] [align-self:start] mt-2 [position-try-fallbacks:flip-block,flip-inline,flip-block_flip-inline]',
  'bottom-start':
    '[position-area:block-end_span-inline-end] [justify-self:start] [align-self:start] mt-2 [position-try-fallbacks:flip-block,flip-inline,flip-block_flip-inline]',
  'top-end':
    '[position-area:block-start_span-inline-start] [justify-self:end] [align-self:end] mb-2 [position-try-fallbacks:flip-block,flip-inline,flip-block_flip-inline]',
  'top-start':
    '[position-area:block-start_span-inline-end] [justify-self:start] [align-self:end] mb-2 [position-try-fallbacks:flip-block,flip-inline,flip-block_flip-inline]',
}

const supportsAnchorPositioning = () =>
  typeof CSS !== 'undefined' && CSS.supports('position-area', 'block-end')

// No external subscription: the support check never changes at runtime, so
// there is nothing to subscribe to.
const subscribeNoop = () => () => {}

export default function PopoverBase({
  anchor = 'bottom-end',
  trigger,
  triggerClassName,
  popoverClassName,
  disabled,
  closeOnSelect = true,
  onToggle,
  id: explicitId,
  children,
}: PopoverBaseProps) {
  // useId must be called unconditionally; the sanitized id is only used when
  // no explicit `id` prop is given.
  const generatedId = safeId(useId())
  const id = explicitId ?? generatedId

  const popoverRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  // Chrome does not expose implicit aria-expanded on commandfor buttons, so
  // mirror the popover state explicitly.
  const [open, setOpen] = useState(false)

  // React owns the popover className, so the JS-fallback `menu-no-anchor`
  // class is derived from state instead of added imperatively (an imperative
  // class would be wiped whenever React re-renders className). Server
  // snapshot false keeps hydration consistent; React re-renders with the
  // client snapshot after hydration.
  const noAnchor = useSyncExternalStore(
    subscribeNoop,
    () => !supportsAnchorPositioning(),
    () => false,
  )

  /**
   * JS fallback when CSS anchor positioning is unsupported: the UA already
   * positions an open popover fixed in the top layer, so on open we only
   * compute top/left from the trigger rect and recompute while open.
   */
  useEffect(() => {
    const popoverEl = popoverRef.current
    const triggerEl = triggerRef.current
    if (!popoverEl || !triggerEl || !noAnchor) return

    const position = () => {
      const r = triggerEl.getBoundingClientRect()
      const w = popoverEl.offsetWidth
      const h = popoverEl.offsetHeight
      const gap = 8
      let top = anchor.startsWith('top') ? r.top - h - gap : r.bottom + gap
      let left = anchor.endsWith('end') ? r.right - w : r.left
      left = Math.min(Math.max(left, 8), window.innerWidth - w - 8)
      top = Math.min(Math.max(top, 8), window.innerHeight - h - 8)
      popoverEl.style.top = `${top}px`
      popoverEl.style.left = `${left}px`
    }

    const onToggleEvent = (e: Event) => {
      const {newState} = e as Event & {newState: string}
      if (newState === 'open') {
        popoverEl.style.position = 'fixed'
        popoverEl.style.inset = 'auto'
        position()
        window.addEventListener('scroll', position, true)
        window.addEventListener('resize', position)
      } else {
        window.removeEventListener('scroll', position, true)
        window.removeEventListener('resize', position)
        popoverEl.style.position = ''
        popoverEl.style.inset = ''
        popoverEl.style.top = ''
        popoverEl.style.left = ''
      }
    }

    popoverEl.addEventListener('toggle', onToggleEvent)
    return () => {
      popoverEl.removeEventListener('toggle', onToggleEvent)
      window.removeEventListener('scroll', position, true)
      window.removeEventListener('resize', position)
    }
  }, [anchor, noAnchor])

  // Chrome ignores `position-visibility: anchors-visible`: when the trigger
  // scrolls fully off-screen the popover stays open, clipped at the viewport
  // edge. Same workaround as the JS fallback above — hide the popover once
  // the trigger leaves the viewport.
  useEffect(() => {
    if (!open) return
    const check = () => {
      const triggerEl = triggerRef.current
      const popoverEl = popoverRef.current
      if (!triggerEl || !popoverEl?.matches(':popover-open')) return
      const r = triggerEl.getBoundingClientRect()
      if (r.bottom < 0 || r.top > window.innerHeight) popoverEl.hidePopover()
    }
    window.addEventListener('scroll', check, {capture: true})
    return () => window.removeEventListener('scroll', check, {capture: true})
  }, [open])

  // Close on select: a click that lands on an enabled <a>/<button> inside the
  // popover dismisses it.
  const handlePopoverClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!closeOnSelect) return
    const target = (e.target as HTMLElement).closest('a,button')
    if (!target) return
    if (
      target.hasAttribute('disabled') ||
      (target as HTMLButtonElement).disabled ||
      target.getAttribute('aria-disabled') === 'true'
    ) {
      return
    }
    popoverRef.current?.hidePopover()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        {...{commandfor: id, command: 'toggle-popover'}}
        popoverTarget={id}
        popoverTargetAction="toggle"
        aria-expanded={open}
        aria-controls={id}
        className={triggerClassName}
      >
        {trigger}
      </button>

      <div
        ref={popoverRef}
        id={id}
        popover="auto"
        onClick={handlePopoverClick}
        onToggle={(e) => {
          const isOpen = (e as ToggleEvent<HTMLDivElement>).newState === 'open'
          setOpen(isOpen)
          onToggle?.(isOpen)
        }}
        className={classNames(
          'menu-popover',
          noAnchor && 'menu-no-anchor',
          // `overflow-y` still clips, so rounded corners are preserved while
          // long popovers scroll instead of overflowing the viewport.
          // `overflow-x` is explicit so horizontal clipping is guaranteed.
          'max-h-[calc(100vh-16px)] overflow-x-hidden overflow-y-auto',
          ANCHOR_CLASSES[anchor],
          popoverClassName,
        )}
      >
        {children}
      </div>
    </>
  )
}
