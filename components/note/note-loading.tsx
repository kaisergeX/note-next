import NoteCard from './note-card'

export function NoteListSkeleton() {
  return (
    <div
      aria-hidden
      className="note-grid grid items-start gap-4 pb-8 motion-safe:animate-pulse"
    >
      {Array.from({length: 6}, (_, index) => (
        <NoteCard key={index}>
          <div className="space-y-4 p-4">
            <div className="bg-ink-tint h-6 w-2/3 rounded-sm" />
            <div className="space-y-2">
              {Array.from({length: 3 + (index % 3)}, (_, line) => (
                <div
                  key={line}
                  className={`bg-ink-tint h-3 rounded-sm ${line % 2 ? 'w-5/6' : 'w-full'}`}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end px-3 pt-1 pb-2">
            <div className="bg-ink-tint size-8 rounded-full" />
          </div>
        </NoteCard>
      ))}
    </div>
  )
}

export function NoteCollectionLoading({label}: {label: string}) {
  return (
    <main className="body-h-auto w-full" role="status" aria-busy="true">
      <div className="mb-4 flex min-h-10 items-center justify-between gap-4">
        <p className="text-ink-muted text-sm">{label}</p>
        <div aria-hidden className="bg-ink-tint h-10 w-28 rounded-md" />
      </div>
      <NoteListSkeleton />
    </main>
  )
}

export function NoteEditorLoading({label}: {label: string}) {
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex min-h-80 flex-1 flex-col"
    >
      <p className="text-ink-muted px-4 py-4 text-sm">{label}</p>
      <div
        aria-hidden
        className="flex flex-1 flex-col motion-safe:animate-pulse"
      >
        <div className="px-4 py-6 sm:px-8">
          <div className="bg-ink-tint h-8 w-2/3 max-w-lg rounded-sm" />
        </div>
        <div className="border-hairline flex gap-2 border-y px-4 py-3">
          {Array.from({length: 5}, (_, index) => (
            <div key={index} className="bg-ink-tint size-10 rounded-md" />
          ))}
        </div>
        <div className="flex-1 space-y-3 px-4 py-6 sm:px-8">
          <div className="bg-ink-tint h-3 w-full max-w-2xl rounded-sm" />
          <div className="bg-ink-tint h-3 w-5/6 max-w-xl rounded-sm" />
          <div className="bg-ink-tint h-3 w-2/3 max-w-lg rounded-sm" />
        </div>
      </div>
    </div>
  )
}
