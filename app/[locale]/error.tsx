'use client'
import type {ServerError} from '~/types'

export default function Error({
  error,
  reset,
}: {
  error: ServerError
  reset: () => void
}) {
  return (
    <div className="flex-center h-full flex-col gap-4">
      <div>
        <h1>{error.message || 'Something went wrong!'}</h1>
        <p className="text-center text-sm text-zinc-400">{error.digest}</p>
      </div>

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
