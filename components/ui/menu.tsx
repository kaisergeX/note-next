'use client'

/**
 * Native Popover API menu built on the `PopoverBase` primitive
 * (components/ui/popover.tsx), which owns all fallback/keyboard/a11y behavior.
 *
 * Deliberately NO role="menu"/menuitem here: this is a disclosure pattern —
 * Tab/Shift+Tab move between items and Esc closes the disclosure. Optional
 * Arrow/Home/End/typeahead navigation supplements normal link semantics.
 */

import {cn} from 'cn'
import Link from 'next/link'
import {Fragment, type PropsWithChildren, type ReactNode} from 'react'
import {MenuItemButton} from './button'
import PopoverBase, {type PopoverAnchor} from './popover'

export type MenuCustomItem = {
  disabled?: boolean
  hidden?: boolean
} & (
  | {
      type: 'link'
      className?: string
      url: string
      label: ReactNode
      lang?: string
      ariaCurrent?: 'page'
    }
  | {
      type: 'action'
      label: ReactNode
      onSelect: () => void
      destructive?: boolean
    }
  | {type?: undefined; component: ReactNode}
)

type MenuCustomProps = PropsWithChildren<{
  /** Trigger button content and classes. */
  className?: string
  /** Accessible name when the trigger has no visible or screen-reader text. */
  ariaLabel?: string
  itemsClassName?: string
  items?: MenuCustomItem[]
  disabled?: boolean
  /** Popover position relative to the trigger button. */
  anchor?: PopoverAnchor
}>

const BASE_CLASSES =
  'bg-paper-raised text-ink shadow-sheet rounded-md border border-hairline text-sm font-semibold focus:outline-none'

export default function MenuCustom({
  className,
  ariaLabel,
  itemsClassName = '',
  items = [],
  disabled,
  anchor = 'bottom-end',
  children,
}: MenuCustomProps) {
  return (
    <PopoverBase
      keyboardNavigation
      anchor={anchor}
      trigger={children}
      triggerAriaLabel={ariaLabel}
      triggerClassName={className}
      disabled={disabled}
      className={cn(BASE_CLASSES, itemsClassName)}
    >
      {items.flatMap((item, index) => {
        if (item.hidden) return []

        return item.type === 'link' ? (
          <Link
            key={index}
            href={item.url}
            lang={item.lang}
            aria-current={item.ariaCurrent}
            aria-disabled={item.disabled ? 'true' : undefined}
            data-disabled={item.disabled ? '' : undefined}
            className={cn(
              'hover:bg-ink-tint focus-visible:bg-ink-tint focus-visible:outline-accent data-disabled:disabled flex items-center gap-2 px-3 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
              item.className || '',
            )}
            onClick={(e) => {
              if (item.disabled) e.preventDefault()
            }}
          >
            {item.label}
          </Link>
        ) : item.type === 'action' ? (
          <MenuItemButton
            key={index}
            type="button"
            destructive={item.destructive}
            disabled={item.disabled}
            onClick={item.onSelect}
          >
            {item.label}
          </MenuItemButton>
        ) : item.disabled ? (
          // Component items get no disabled styling from this wrapper, so
          // disable them via the DOM: no pointer events + aria-disabled.
          <div key={index} aria-disabled="true" className="pointer-events-none">
            {item.component}
          </div>
        ) : (
          <Fragment key={index}>{item.component}</Fragment>
        )
      })}
    </PopoverBase>
  )
}
