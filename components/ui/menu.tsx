'use client'

/**
 * Native Popover API menu built on the `PopoverBase` primitive
 * (components/ui/popover.tsx), which owns all fallback/keyboard/a11y behavior.
 *
 * Deliberately NO role="menu"/menuitem here: this is a disclosure pattern —
 * keyboard support is Tab/Shift+Tab to move between items and Esc to close,
 * per the ARIA APG disclosure guidance. Do not add menu roles unless
 * arrow-key navigation is implemented (menu roles require menu semantics).
 */

import {classNames} from '@kaiverse/k/utils'
import Link from 'next/link'
import {Fragment, type PropsWithChildren, type ReactNode} from 'react'
import PopoverBase, {type PopoverAnchor} from './popover'

export type MenuCustomItem = {
  disabled?: boolean
  hidden?: boolean
} & (
  | {type: 'link'; className?: string; url: string; label: ReactNode}
  | {type?: undefined; component: ReactNode}
)

type MenuCustomProps = PropsWithChildren<{
  /** Trigger button content and classes. */
  className?: string
  itemsClassName?: string
  items?: MenuCustomItem[]
  /** Popover position relative to the trigger button. */
  anchor?: PopoverAnchor
}>

const BASE_CLASSES =
  'bg-default shadow-theme ring-theme rounded-md border border-gray-400 text-sm font-semibold focus:outline-none dark:border-gray-900'

export default function MenuCustom({
  className,
  itemsClassName = '',
  items = [],
  anchor = 'bottom-end',
  children,
}: MenuCustomProps) {
  return (
    <PopoverBase
      anchor={anchor}
      trigger={children}
      triggerClassName={className}
      popoverClassName={classNames(BASE_CLASSES, itemsClassName)}
    >
      {items.flatMap((item, index) => {
        if (item.hidden) return []

        return item.type === 'link' ? (
          <Link
            key={index}
            href={item.url}
            aria-disabled={item.disabled ? 'true' : undefined}
            data-disabled={item.disabled ? '' : undefined}
            className={classNames(
              'hover:bg-reverse focus-visible:bg-reverse data-disabled:disabled flex items-center gap-2 p-4 transition-colors',
              item.className || '',
            )}
            onClick={(e) => {
              if (item.disabled) e.preventDefault()
            }}
          >
            {item.label}
          </Link>
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
