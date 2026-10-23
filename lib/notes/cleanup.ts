import 'server-only'

import {createHash, timingSafeEqual} from 'node:crypto'
import {getNoteMutationCacheKeys} from '~/db/helper'

export const NOTE_CLEANUP_BATCH_SIZE = 100
export const NOTE_CLEANUP_MAX_BATCHES = 5
export const NOTE_CLEANUP_BUDGET_MS = 20_000

export type DeletedNoteIdentity = {id: string; authorId: string}
type CleanupDependencies = {
  // The callback runs before commit; invalidation failure rolls back this batch.
  deleteBatch: (
    limit: number,
    beforeCommit: (rows: DeletedNoteIdentity[]) => void,
  ) => Promise<DeletedNoteIdentity[]>
  invalidateTag: (tag: string) => void
  now?: () => number
}

export async function runNoteCleanup({
  deleteBatch,
  invalidateTag,
  now = () => performance.now(),
}: CleanupDependencies) {
  const started = now()
  let deleted = 0
  let batches = 0
  try {
    while (batches < NOTE_CLEANUP_MAX_BATCHES) {
      if (batches && now() - started >= NOTE_CLEANUP_BUDGET_MS)
        return {ok: true, deleted, batches, bounded: true}
      const rows = await deleteBatch(NOTE_CLEANUP_BATCH_SIZE, (identities) => {
        const tags = new Set(
          identities.flatMap(({authorId, id}) =>
            getNoteMutationCacheKeys(authorId, id),
          ),
        )
        for (const tag of tags) invalidateTag(tag)
      })
      deleted += rows.length
      batches++
      // Locked rows may remain. A later invocation can safely revisit them.
      if (rows.length < NOTE_CLEANUP_BATCH_SIZE)
        return {ok: true, deleted, batches, bounded: false}
    }
    return {ok: true, deleted, batches, bounded: true}
  } catch {
    // Do not expose SQL errors: they can contain note bodies or credentials.
    return {ok: false, deleted, batches, bounded: false}
  }
}

export async function handleNoteCleanup(
  request: Request,
  dependencies: CleanupDependencies & {
    secret: string | undefined
    log?: (result: Awaited<ReturnType<typeof runNoteCleanup>>) => void
  },
) {
  const headers = {'Cache-Control': 'private, no-store'}
  if (request.method !== 'GET')
    return new Response(null, {
      status: 405,
      headers: {...headers, Allow: 'GET'},
    })
  if (!dependencies.secret)
    return Response.json(
      {error: 'Cleanup is not configured'},
      {status: 503, headers},
    )
  const digest = (value: string) => createHash('sha256').update(value).digest()
  if (
    !timingSafeEqual(
      digest(request.headers.get('authorization') ?? ''),
      digest(`Bearer ${dependencies.secret}`),
    )
  )
    return Response.json({error: 'Unauthorized'}, {status: 401, headers})
  const result = await runNoteCleanup(dependencies)
  ;(dependencies.log ?? ((summary) => console.info('Note cleanup', summary)))(
    result,
  )
  return Response.json(result, {status: result.ok ? 200 : 500, headers})
}
