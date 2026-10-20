'use client'

import '../globals.css'

import type {ServerError} from '~/types'
import {createAppearanceBootstrapScript} from '~/lib/appearance'
import Button from '~/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: ServerError
  reset: () => void
}) {
  const appearanceScript = createAppearanceBootstrapScript(
    process.env.SERVICE_NAME ?? 'etoN-app',
  )

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: appearanceScript}} />
      </head>
      <body className="flex-center bg-paper text-ink h-dvh flex-col gap-4 font-sans">
        <div className="text-center">
          <h1>Something went wrong!</h1>
          <p className="text-ink-muted text-center text-sm">{error.digest}</p>
        </div>

        <Button onClick={() => reset()}>Try again</Button>
      </body>
    </html>
  )
}
