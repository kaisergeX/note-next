'use client'

export default function Error({reset}: {error: Error; reset: () => void}) {
  return (
    <div className="flex-center h-full flex-col">
      <h1>Something went wrong!</h1>
      <button
        className="button"
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
