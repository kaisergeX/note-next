import {unstable_ViewTransition as ViewTransition} from 'react'

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
