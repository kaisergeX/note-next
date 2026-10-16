'use client'
import type {ServerError} from '~/types'
import Button from '~/components/ui/button'

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
        <p className="text-ink-muted mt-4 text-sm">
          {error.digest} {error.digest ? '' : error.message}
        </p>
      </div>

      <Button
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
      >
        Try again
      </Button>
    </div>
  )
}
