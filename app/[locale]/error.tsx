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
      <div className="text-center">
        <h1 className="mb-4 capitalize">Something went wrong!</h1>
        <p className="text-sm text-zinc-400">{error.digest || error.message}</p>
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
