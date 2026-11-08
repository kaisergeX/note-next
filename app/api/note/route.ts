import {NextResponse} from 'next/server'
import {z} from 'zod'
import {getNotePage, getNotePreviews} from '~/db/helper/notes'
import {defineAuthRoute} from '~/server-utils'
import {noteIdSchema} from '~/lib/notes/validation'

const headers = {'Cache-Control': 'private, no-store'}
const cursorSchema = z.object({
  id: noteIdSchema,
  createdAt: z.iso.datetime({precision: 6}),
})

export const GET = defineAuthRoute(async ({request, session}) => {
  const raw = request.nextUrl.searchParams.get('cursor')
  let cursor = null
  if (raw !== null) {
    try {
      cursor = cursorSchema.parse(JSON.parse(raw))
    } catch {
      return NextResponse.json(
        {message: 'Invalid cursor'},
        {status: 400, headers},
      )
    }
  }
  const page = await getNotePage(session.user.id, cursor)
  return NextResponse.json({ownerId: session.user.id, ...page}, {headers})
})

// Resolve only browser-work identities, independent of the loaded list pages.
export const POST = defineAuthRoute(async ({request, session}) => {
  const parsed = z
    .array(noteIdSchema)
    .max(100)
    .safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return NextResponse.json(
      {message: 'Invalid identities'},
      {status: 400, headers},
    )
  return NextResponse.json(
    {
      ownerId: session.user.id,
      notes: await getNotePreviews(session.user.id, parsed.data),
    },
    {headers},
  )
})
