import {NextResponse} from 'next/server'
import {getNote} from '~/db/helper/notes'
import type {PropsWithLocale} from '~/types'
import {defineAuthRoute} from '~/util'

export const GET = defineAuthRoute<
  PropsWithLocale<unknown, {id: string}>['params']
>(async ({params, session}) => {
  const noteId = (await params).id
  if (!noteId) {
    return NextResponse.json({message: 'Note id is required'}, {status: 400})
  }

  const email = session.user.email
  const notes = await getNote(noteId, email)
  return NextResponse.json(notes, {status: 200})
})
