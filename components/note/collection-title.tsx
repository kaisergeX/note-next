export default function CollectionTitle({
  title,
  count,
  countLabel,
  countId,
}: {
  title: string
  count?: number
  countLabel?: string
  countId?: string
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <h1 className="text-base font-semibold">{title}</h1>
      {count !== undefined && (
        <span
          id={countId}
          data-trash-count={countId ? '' : undefined}
          tabIndex={countId ? -1 : undefined}
          aria-label={countLabel}
          className="text-ink-muted focus-visible:outline-accent text-xs font-normal tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span aria-hidden>· </span>
          {count}
        </span>
      )}
    </div>
  )
}
