'use client'

export default function GlobalError({
  reset,
  params: {locale},
}: {
  error: Error
  reset: () => void
  params: {locale: string}
}) {
  return (
    <html lang={locale}>
      <body className="flex-center h-[100dvh] flex-col font-inter">
        <h2>Something went wrong!</h2>
        <button className="button" onClick={() => reset()}>
          Try again
        </button>
      </body>
    </html>
  )
}
