import type {ReactNode} from 'react'
import {requireAuth} from '~/util'

type Props = {
  children: ReactNode
  modal: ReactNode
}

export default async function NoteLayout({children, modal}: Props) {
  await requireAuth()

  return (
    <>
      {children}
      {modal}
    </>
  )
}
