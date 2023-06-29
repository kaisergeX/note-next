'use client'

export default function GlobalError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="flex-center h-full flex-col">
      <h2>Something went wrong!</h2>
      <button
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
      >
        Try again
      </button>
    </div>
  )
}
