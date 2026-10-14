import {classNames} from '@kaiverse/k/utils'
import type {ComponentPropsWithRef} from 'react'

type BadgeStatus = 'draft' | 'active' | 'archived' | 'accent' | 'neutral'

interface BadgeProps extends ComponentPropsWithRef<'span'> {
  status?: BadgeStatus
  dot?: boolean
}

const STATUS_CLASSES: Record<BadgeStatus, string> = {
  draft: 'border-amber-500/40 text-amber-600 dark:text-amber-400',
  active: 'border-success/40 text-success',
  archived: 'border-hairline text-ink-muted',
  accent: 'border-accent/40 text-accent',
  neutral: 'border-hairline text-ink',
}

const BASE_CLASSES =
  'inline-flex items-center gap-1 rounded-full border bg-paper-raised px-2 py-0.5 text-xs font-medium'

/** Paper & Ink status pill: paper-raised fill, hairline border, role-colored text. */
export function Badge({
  status = 'neutral',
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={classNames(BASE_CLASSES, STATUS_CLASSES[status], className)}
      {...props}
    >
      {dot ? (
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
      ) : null}
      {children}
    </span>
  )
}

export type {BadgeProps, BadgeStatus}
