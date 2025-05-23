import {classNames} from '@kaiverse/k/utils'
import type {PropsWithChildren} from 'react'

type BadgeProps = {
  className?: string
  pingClassName?: string
  withPing?: boolean
}

export default function Badge({
  className = '',
  pingClassName = '',
  withPing,
  children,
}: PropsWithChildren<BadgeProps>) {
  const renderPing = withPing ? (
    <span
      className={classNames(
        'absolute top-0 right-0 -mt-1 -mr-1 flex h-3 w-3',
        pingClassName,
      )}
    >
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-500" />
    </span>
  ) : (
    <></>
  )

  return (
    <div
      className={classNames(
        'bg-reverse relative inline-block cursor-default rounded-xl px-2 py-0.5 text-sm',
        className,
      )}
    >
      {renderPing}
      {children}
    </div>
  )
}
