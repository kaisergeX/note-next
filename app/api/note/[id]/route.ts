import {NextResponse} from 'next/server'
import {getNote} from '~/db/helper/notes'
import {defineAuthRoute} from '~/server-utils'

export const GET = defineAuthRoute<RouteContext<'/api/note/[id]'>['params']>(
  async ({params, session}) => {
    const note = await getNote(session.user.id, (await params).id)
    // Authenticated note content must not enter HTTP/browser caches.
    return NextResponse.json(note ?? {message: 'Note not found'}, {
      status: note ? 200 : 404,
      headers: {'Cache-Control': 'private, no-store'},
    })
  },
)
