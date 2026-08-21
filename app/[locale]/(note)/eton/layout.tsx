import {ViewTransition} from 'react'

export const instant = false

export default function NoteLayout({
  children,
  modal,
}: LayoutProps<'/[locale]/eton'>) {
  return (
    <ViewTransition>
      {children}
      {modal}
    </ViewTransition>
  )
}
