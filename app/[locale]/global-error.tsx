'use client'

import type {ServerError} from '~/types'

export default function GlobalError({
  error,
  reset,
}: {
  error: ServerError
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="flex-center h-[100dvh] flex-col gap-4 font-inter">
        <div className="text-center">
          <h1>Something went wrong!</h1>
          <p className="text-center text-sm text-zinc-400">{error.digest}</p>
        </div>

        <button className="button" onClick={() => reset()}>
          Try again
        </button>
      </body>
    </html>
  )
}
