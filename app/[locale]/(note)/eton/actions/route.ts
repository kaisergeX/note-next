import {getServerSession} from 'next-auth'
import {NextResponse} from 'next/server'
import {authOptions} from '~/config/auth'
import {getNote} from '~/db/helper/notes'
import type {ServerError} from '~/types'

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url)
  const noteId = searchParams.get('id')

  if (!noteId) {
    return NextResponse.json({error: 'Note id is required'}, {status: 400})
  }

  const session = await getServerSession(authOptions)
  const email = session?.user?.email

  if (!email) {
    return NextResponse.json({error: 'Permission Denied'}, {status: 403})
  }

  try {
    const notes = await getNote(noteId, email)
    return NextResponse.json(notes, {status: 200})
  } catch (error) {
    const serverErr = error as ServerError
    return NextResponse.json({message: serverErr.message}, {status: 500})
  }
}
