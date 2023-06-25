import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex h-full flex-col items-center justify-center p-4">
      <div className="mb-8 flex items-center gap-4 divide-x divide-slate-400">
        <h1>404</h1>
        <h2 className="py-4 pl-4">This page could not be found.</h2>
      </div>

      <Link href="/" className="button">
        Homepage <span aria-hidden="true">&rarr;</span>
      </Link>
    </main>
  )
}
