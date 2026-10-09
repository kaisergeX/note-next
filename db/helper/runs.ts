import {and, desc, eq, inArray, sql} from 'drizzle-orm'
import {db} from '..'
import {personasTable} from '../schema/personas'
import {
  runItemsTable,
  runsTable,
  type Run,
  type RunItem,
  type RunStatus,
} from '../schema/transcripts'

export type RunProgress = {
  total: number
  done: number
  failed: number
  pending: number
}

export async function createRun(input: {
  questionScript: string[]
  personaIds: string[]
  /** Optional interview purpose; undefined flows through to SQL NULL. */
  researchContext?: string | null
}): Promise<Run> {
  return await db.transaction(async (tx) => {
    const [run] = await tx
      .insert(runsTable)
      .values({
        questionScript: input.questionScript,
        personaIds: input.personaIds,
        researchContext: input.researchContext ?? null,
      })
      .returning()
    if (input.personaIds.length > 0) {
      await tx.insert(runItemsTable).values(
        input.personaIds.map((personaId) => ({
          runId: run!.id,
          personaId,
        })),
      )
    }
    return run!
  })
}

/**
 * Any run_item referencing one persona. Draft personas should have none
 * (only kept personas enter runs) — this guard is the safety net before a
 * hard delete, since run_items.persona_id has no ON DELETE cascade and
 * there is no run-delete path in v1 (deleting the persona would 500 on the
 * FK violation).
 */
export async function personaHasRunItems(personaId: string): Promise<boolean> {
  const [row] = await db
    .select({id: runItemsTable.id})
    .from(runItemsTable)
    .where(eq(runItemsTable.personaId, personaId))
    .limit(1)
  return row !== undefined
}

export async function getRunById(id: string): Promise<Run | undefined> {
  const [row] = await db
    .select()
    .from(runsTable)
    .where(eq(runsTable.id, id))
    .limit(1)
  return row
}

/**
 * All runs, newest first, each with its item counts folded into a
 * RunProgress in a single grouped query (no per-run getRunProgress round trip).
 */
export async function listRuns(): Promise<
  Array<{run: Run; progress: RunProgress}>
> {
  const rows = await db
    .select({
      run: runsTable,
      total: sql<number>`count(${runItemsTable.id})::int`,
      done: sql<number>`(count(*) filter (where ${runItemsTable.status} = 'done'))::int`,
      failed: sql<number>`(count(*) filter (where ${runItemsTable.status} = 'failed'))::int`,
    })
    .from(runsTable)
    .leftJoin(runItemsTable, eq(runItemsTable.runId, runsTable.id))
    .groupBy(runsTable.id)
    .orderBy(desc(runsTable.createdAt))
  return rows.map((row) => {
    const total = Number(row.total)
    const done = Number(row.done)
    const failed = Number(row.failed)
    return {
      run: row.run,
      progress: {total, done, failed, pending: total - done - failed},
    }
  })
}

export async function listRunItems(
  runId: string,
): Promise<Array<RunItem & {personaName: string}>> {
  const rows = await db
    .select({item: runItemsTable, personaName: personasTable.name})
    .from(runItemsTable)
    .innerJoin(personasTable, eq(runItemsTable.personaId, personasTable.id))
    .where(eq(runItemsTable.runId, runId))
    .orderBy(runItemsTable.id)
  return rows.map((row) => ({...row.item, personaName: row.personaName}))
}

/**
 * `pending` folds in `in_progress` items too: for the UI "N of M done",
 * anything not yet done/failed is outstanding work.
 */
export async function getRunProgress(runId: string): Promise<RunProgress> {
  const rows = await db
    .select({status: runItemsTable.status, count: sql<number>`count(*)::int`})
    .from(runItemsTable)
    .where(eq(runItemsTable.runId, runId))
    .groupBy(runItemsTable.status)
  const progress: RunProgress = {total: 0, done: 0, failed: 0, pending: 0}
  for (const row of rows) {
    const count = Number(row.count)
    progress.total += count
    if (row.status === 'done') progress.done += count
    else if (row.status === 'failed') progress.failed += count
    else progress.pending += count
  }
  return progress
}

/**
 * Atomic claim: one SELECT ... FOR UPDATE SKIP LOCKED inside a transaction,
 * then the status flip — two tabs (or a retry racing a stalled step) can
 * never claim the same item; the loser skips to the next row. Claiming also
 * picks up `in_progress` items so a resume continues a stalled step instead
 * of deadlocking the run.
 *
 * Ordering is pending-first, then by id: a run_item covers one persona's
 * WHOLE script and stays `in_progress` between its own questions, so strict
 * id order would let persona A run every question before B starts. With
 * pending items claimed before in_progress ones, personas alternate
 * round-robin (A, B, A, B) while both are pending, then drain; a stalled
 * in_progress item is still reclaimable once no pending work remains.
 */
export async function claimNextRunItem(
  runId: string,
): Promise<RunItem | undefined> {
  return await db.transaction(async (tx) => {
    const [candidate] = await tx
      .select({id: runItemsTable.id})
      .from(runItemsTable)
      .where(
        and(
          eq(runItemsTable.runId, runId),
          inArray(runItemsTable.status, ['pending', 'in_progress']),
        ),
      )
      // Single statement: pending before in_progress, id order within each
      // group.
      .orderBy(
        sql`case ${runItemsTable.status} when 'pending' then 0 else 1 end`,
        runItemsTable.id,
      )
      .limit(1)
      .for('update', {skipLocked: true})
    if (!candidate) return undefined
    const [row] = await tx
      .update(runItemsTable)
      .set({status: 'in_progress'})
      .where(eq(runItemsTable.id, candidate.id))
      .returning()
    return row!
  })
}

export async function markRunItemStatus(
  itemId: string,
  status: 'done' | 'failed',
  error?: string | null,
): Promise<void> {
  await db
    .update(runItemsTable)
    .set({status, error: status === 'done' ? null : (error ?? null)})
    .where(eq(runItemsTable.id, itemId))
}

/**
 * Marks the run `done` when no claimable items remain; otherwise just bumps
 * `updatedAt` (stall-detection column). The run-level `failed` status is
 * unused in v1 — a run ending with failed items is `done` + partial flag.
 */
export async function finishRunIfComplete(runId: string): Promise<RunStatus> {
  const [remaining] = await db
    .select({id: runItemsTable.id})
    .from(runItemsTable)
    .where(
      and(
        eq(runItemsTable.runId, runId),
        inArray(runItemsTable.status, ['pending', 'in_progress']),
      ),
    )
    .limit(1)
  if (remaining) {
    await db
      .update(runsTable)
      .set({updatedAt: new Date()})
      .where(eq(runsTable.id, runId))
    return 'in_progress'
  }
  await db
    .update(runsTable)
    .set({status: 'done', updatedAt: new Date()})
    .where(eq(runsTable.id, runId))
  return 'done'
}

/**
 * Reset-failed-items hook for the researcher's "re-run failed" action. A
 * `done` run with newly reset items flips back to `in_progress` so the
 * client loop resumes. Returns the number of items requeued.
 */
export async function retryFailedRunItems(runId: string): Promise<number> {
  const retried = await db
    .update(runItemsTable)
    .set({status: 'pending', error: null})
    .where(
      and(eq(runItemsTable.runId, runId), eq(runItemsTable.status, 'failed')),
    )
    .returning({id: runItemsTable.id})

  const run = await getRunById(runId)
  await db
    .update(runsTable)
    .set(
      run?.status === 'done'
        ? {status: 'in_progress', updatedAt: new Date()}
        : {updatedAt: new Date()},
    )
    .where(eq(runsTable.id, runId))

  return retried.length
}
