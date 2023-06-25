import {type ReactNode} from 'react'

export const metadata = {
  title: 'etoN - Admin Portal',
  description:
    'Admin Portal of "etoN" - A minimalistic note-taking app for everyone.',
}

type Props = {
  children: ReactNode
}

export default function LocaleLayout({children}: Props) {
  // add route protection here

  return (
    <main className="bg-fancy flex min-h-screen flex-col items-center justify-center p-24">
      {children}
    </main>
  )
}
