'use client'

import '../globals.css'

import type {ServerError} from '~/types'
import Button from '~/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: ServerError
  reset: () => void
}) {
  const darkModeScript = `(function(){try{var s=JSON.parse(localStorage.getItem('${
    process.env.SERVICE_NAME ?? 'etoN-app'
  }')||'null');var t=s&&s.state&&s.state.theme;if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`

  return (
    <html lang="en" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{__html: darkModeScript}} />
      <body className="flex-center bg-paper font-inter text-ink h-dvh flex-col gap-4">
        <div className="text-center">
          <h1>Something went wrong!</h1>
          <p className="text-ink-muted text-center text-sm">{error.digest}</p>
        </div>

        <Button onClick={() => reset()}>Try again</Button>
      </body>
    </html>
  )
}
