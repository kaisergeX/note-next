import {type NextRequest, NextResponse} from 'next/server'
import {auth} from '~/config/auth'
import {getNote} from '~/db/helper/notes'
import type {PropsWithLocale, ServerError} from '~/types'

export async function GET(
  _: NextRequest,
  props: PropsWithLocale<unknown, {id: string}>,
) {
  const noteId = (await props.params).id
  if (!noteId) {
    return NextResponse.json({message: 'Note id is required'}, {status: 400})
  }

  // protected by middleware, no need to check auth here,
  // session's email is always available and valid
  const session = await auth()
  const email = session?.user?.email

  try {
    const notes = await getNote(noteId, email!)
    return NextResponse.json(notes, {status: 200})
  } catch (error) {
    const serverErr = error as ServerError
    return NextResponse.json({message: serverErr.message}, {status: 500})
  }
}
