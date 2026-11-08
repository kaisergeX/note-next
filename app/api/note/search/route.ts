import {NextResponse} from 'next/server'
import {z} from 'zod'
import {db} from '~/db'
import {createNoteSearchRepository} from '~/db/repositories/note-search'
import {defineAuthRoute} from '~/server-utils'
import {noteIdSchema} from '~/lib/notes/validation'
import {
  NOTE_SEARCH_QUERY_LIMIT,
  NoteSearchNotReadyError,
} from '~/lib/notes/search'

const headers = {'Cache-Control': 'private, no-store'}
const requestSchema = z.object({
  query: z.string().max(NOTE_SEARCH_QUERY_LIMIT),
  cursor: z
    .object({id: noteIdSchema, createdAt: z.iso.datetime({precision: 6})})
    .nullable(),
})

// POST keeps private search terms out of URLs, history and routine access logs.
export const POST = defineAuthRoute(async ({request, session}) => {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return NextResponse.json(
      {message: 'Invalid search'},
      {status: 400, headers},
    )
  try {
    const page = await createNoteSearchRepository(db).search(
      session.user.id,
      parsed.data.query,
      parsed.data.cursor,
    )
    return NextResponse.json({ownerId: session.user.id, ...page}, {headers})
  } catch (error) {
    if (error instanceof NoteSearchNotReadyError)
      return NextResponse.json(
        {message: 'Search is being prepared', code: 'search_not_ready'},
        {status: 503, headers: {...headers, 'Retry-After': '5'}},
      )
    throw error
  }
})
