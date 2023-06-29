import {type ReactNode} from 'react'

export const metadata = {
  title: 'etoN',
  description: 'A minimalistic note-taking app for everyone.',
}

type Props = {
  children: ReactNode
}

export default function NoteLayout({children}: Props) {
  return children
}
