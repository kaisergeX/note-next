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
    <div className="flex-center h-full flex-col gap-8">
      <div className="text-center">
        <h1>Something went wrong!</h1>
        <p className="mt-4 text-sm text-zinc-400">{error.digest}</p>
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
