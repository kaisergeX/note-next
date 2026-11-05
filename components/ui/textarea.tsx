import {classNames} from '@kaiverse/k/utils'
import type {ComponentPropsWithRef} from 'react'

export function Textarea({
  className,
  ...props
}: ComponentPropsWithRef<'textarea'>) {
  return (
    <textarea
      className={classNames(
        'border-control-border bg-paper-raised text-ink focus:border-accent focus:ring-accent w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}
