import {NextResponse} from 'next/server'
import {getNote} from '~/db/helper/notes'
import {getCachedUser} from '~/db/helper/users'
import {defineAuthRoute} from '~/server-utils'

export const GET = defineAuthRoute<RouteContext<'/api/note/[id]'>['params']>(
  async ({params, session}) => {
    const user = await getCachedUser(session.user.email)
    const note = user ? await getNote(user.id, (await params).id) : null
    // Authenticated note content must not enter HTTP/browser caches.
    return NextResponse.json(note ?? {message: 'Note not found'}, {
      status: note ? 200 : 404,
      headers: {'Cache-Control': 'private, no-store'},
    })
  },
)
