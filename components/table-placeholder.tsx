import RefreshButton from './refresh-button'

export default function TablePlaceholder() {
  return (
    <div className="border-hairline bg-paper-raised mx-auto w-full max-w-xl rounded-lg border p-12">
      <div className="mb-4 flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Recent Users</h2>
          <p className="text-ink-muted text-sm">Fetching users...</p>
        </div>
        <RefreshButton />
      </div>
      <div className="divide-hairline divide-y">
        {Array.from(Array(3).keys()).map((i) => (
          <div key={i} className="flex items-center justify-between py-3">
            <div className="flex items-center space-x-4">
              <div className="bg-ink-tint h-12 w-12 animate-pulse rounded-full" />
              <div className="space-y-1">
                <div className="bg-ink-tint h-6 w-28 animate-pulse rounded-md" />
                <div className="bg-ink-tint h-4 w-24 animate-pulse rounded-md" />
              </div>
            </div>
            <div className="bg-ink-tint h-4 w-12 animate-pulse rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
