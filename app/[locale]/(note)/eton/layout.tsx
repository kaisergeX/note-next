import {ViewTransition} from 'react'

export const instant = false

export default function NoteLayout({
  children,
  modal,
}: LayoutProps<'/[locale]/eton'>) {
  return (
    <ViewTransition update="none">
      {children}
      {/* The native dialog owns its animation; route snapshots flash the list. */}
      <ViewTransition default="none">{modal}</ViewTransition>
    </ViewTransition>
  )
}
