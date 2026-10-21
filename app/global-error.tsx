'use client'

import './globals.css'

import {Inter} from 'next/font/google'
import {useLayoutEffect} from 'react'

import type {ServerError} from '~/types'
import {
  APPEARANCE_STORAGE_KEY,
  applyStoredAppearance,
  syncBrowserThemeColor,
} from '~/lib/appearance'
import Button from '~/components/ui/button'

const inter = Inter({subsets: ['latin'], variable: '--font-inter'})

export default function GlobalError({
  error,
  reset,
}: {
  error: ServerError
  reset: () => void
}) {
  // React renders this fallback on the client after a root-layout failure;
  // inline scripts are inert there. Apply preferences before the next paint.
  useLayoutEffect(() => {
    applyStoredAppearance(APPEARANCE_STORAGE_KEY)
    syncBrowserThemeColor()
  }, [])

  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="" />
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
