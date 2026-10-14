import {classNames} from '@kaiverse/k/utils'
import type {ComponentPropsWithRef} from 'react'

interface InputProps extends ComponentPropsWithRef<'input'> {
  invalid?: boolean
}

const BASE_CLASSES =
  'w-full rounded-md border bg-paper-raised px-3 py-2 text-sm text-ink transition-colors placeholder:text-ink-muted focus:outline-none focus:ring-2'

const STATE_CLASSES = {
  valid: 'border-hairline focus:border-accent focus:ring-accent/25',
  invalid:
    'border-destructive focus:border-destructive focus:ring-destructive/25',
} as const

/** Paper & Ink text input: paper-raised fill, hairline border, accent focus ring. */
export function Input({invalid = false, className, ...props}: InputProps) {
  return (
    <input
      aria-invalid={invalid ? 'true' : undefined}
      className={classNames(
        BASE_CLASSES,
        STATE_CLASSES[invalid ? 'invalid' : 'valid'],
        className,
      )}
      {...props}
    />
  )
}

export type {InputProps}
