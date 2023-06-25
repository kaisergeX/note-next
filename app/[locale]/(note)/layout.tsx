import {type ReactNode} from 'react'

export const metadata = {
  title: 'etoN',
  description: 'A minimalistic note-taking app for everyone.',
}

type Props = {
  children: ReactNode
}

export default function LocaleLayout({children}: Props) {
  // add route protection here

  return children
}
