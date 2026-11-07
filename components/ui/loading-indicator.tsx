import {cn} from 'cn'

export function LoadingSpark() {
  return (
    <span
      aria-hidden="true"
      className="loading-spark grid size-4 shrink-0 grid-cols-2 gap-0.5"
    >
      <span className="rounded-sm bg-current" />
      <span className="rounded-sm bg-current" />
      <span className="rounded-sm bg-current" />
      <span className="rounded-sm bg-current" />
    </span>
  )
}

export default function LoadingIndicator({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <span
      role="status"
      className={cn(
        'text-ink-muted inline-flex max-w-full items-center gap-2 text-sm',
        className,
      )}
    >
      <LoadingSpark />
      <span className="loading-caption min-w-0">{label}</span>
    </span>
  )
}
