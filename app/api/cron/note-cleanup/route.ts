import {revalidateTag} from 'next/cache'
import {connection} from 'next/server'
import {db} from '~/db'
import {createNoteCleanupRepository} from '~/db/repositories/note-cleanup'
import {handleNoteCleanup} from '~/lib/notes/cleanup'

export const maxDuration = 60

const repository = createNoteCleanupRepository(db)

export async function GET(request: Request) {
  await connection()
  return handleNoteCleanup(request, {
    secret: process.env.CRON_SECRET,
    deleteBatch: repository.deleteExpiredBatch,
    invalidateTag: (tag) => revalidateTag(tag, {expire: 0}),
  })
}

// Next otherwise implements HEAD by invoking GET, which must not delete notes.
export function HEAD(request: Request) {
  return GET(request)
}
