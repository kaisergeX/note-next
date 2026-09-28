import {and, desc, eq, isNotNull, isNull, sql} from 'drizzle-orm'
import {db} from '..'
import type {Transcript, TranscriptTurn} from '../schema/transcripts'
import {transcriptsTable} from '../schema/transcripts'

export async function getTranscriptById(
  id: string,
): Promise<Transcript | undefined> {
  const [row] = await db
    .select()
    .from(transcriptsTable)
    .where(eq(transcriptsTable.id, id))
    .limit(1)
  return row
}

export async function listSingleTranscriptsByPersona(
  personaId: string,
): Promise<Transcript[]> {
  return await db
    .select()
    .from(transcriptsTable)
    .where(
      and(
        eq(transcriptsTable.personaId, personaId),
        isNull(transcriptsTable.runId),
        eq(transcriptsTable.mode, 'single'),
      ),
    )
    .orderBy(desc(transcriptsTable.createdAt))
}

/** All run transcripts of one run, keyed by persona on the caller side. */
export async function listRunTranscripts(runId: string): Promise<Transcript[]> {
  return await db
    .select()
    .from(transcriptsTable)
    .where(eq(transcriptsTable.runId, runId))
}

/**
 * Batch-run sidebar rows for one persona: group-mode transcripts linked to a
 * run, newest first. Read-only in the chat UI — run transcripts are managed
 * by the run lifecycle, never renamed/deleted here.
 */
export async function listRunSessionsByPersona(
  personaId: string,
): Promise<Transcript[]> {
  return await db
    .select()
    .from(transcriptsTable)
    .where(
      and(
        eq(transcriptsTable.personaId, personaId),
        isNotNull(transcriptsTable.runId),
        eq(transcriptsTable.mode, 'group'),
      ),
    )
    .orderBy(desc(transcriptsTable.createdAt))
}

/**
 * Every transcript of one persona — single sessions AND run sessions alike,
 * oldest first — for the per-persona export (both modes carry Q&A worth
 * exporting; the other two list helpers are UI-scoped subsets).
 */
export async function listAllTranscriptsByPersona(
  personaId: string,
): Promise<Transcript[]> {
  return await db
    .select()
    .from(transcriptsTable)
    .where(eq(transcriptsTable.personaId, personaId))
    .orderBy(transcriptsTable.createdAt)
}

export async function createSingleTranscript(input: {
  personaId: string
  model: string
  systemPrompt: string
}): Promise<Transcript> {
  const [row] = await db
    .insert(transcriptsTable)
    .values({
      personaId: input.personaId,
      runId: null,
      mode: 'single',
      model: input.model,
      systemPrompt: input.systemPrompt,
      // turns has a DB default ('[]'::jsonb), but the schema's Drizzle default
      // makes the column optional in the insert type anyway — set it explicitly
      // so the row is correct regardless of column-default drift.
      turns: [],
    })
    .returning()
  return row!
}

export async function createRunTranscript(input: {
  personaId: string
  runId: string
  model: string
  systemPrompt: string
}): Promise<Transcript> {
  const [row] = await db
    .insert(transcriptsTable)
    .values({
      personaId: input.personaId,
      runId: input.runId,
      mode: 'group',
      model: input.model,
      systemPrompt: input.systemPrompt,
      turns: [],
    })
    .returning()
  return row!
}

export async function findRunTranscript(
  personaId: string,
  runId: string,
): Promise<Transcript | undefined> {
  const [row] = await db
    .select()
    .from(transcriptsTable)
    .where(
      and(
        eq(transcriptsTable.personaId, personaId),
        eq(transcriptsTable.runId, runId),
      ),
    )
    .limit(1)
  return row
}

export async function deleteTranscriptById(id: string): Promise<boolean> {
  const rows = await db
    .delete(transcriptsTable)
    .where(eq(transcriptsTable.id, id))
    .returning({id: transcriptsTable.id})
  return rows.length > 0
}

export async function setTranscriptTitle(
  id: string,
  title: string | null,
): Promise<Transcript | undefined> {
  const [row] = await db
    .update(transcriptsTable)
    .set({title})
    .where(eq(transcriptsTable.id, id))
    .returning()
  return row
}

/**
 * ATOMIC append: a single `UPDATE ... SET turns = turns || $1::jsonb`
 * statement — never a select-then-write, which would lose turns appended
 * concurrently. The `::jsonb` cast is required: the bound parameter is text
 * and Postgres cannot infer the jsonb overload of `||` for an untyped param.
 */
export async function appendTranscriptTurn(
  transcriptId: string,
  turn: TranscriptTurn,
): Promise<Transcript | undefined> {
  return await appendTranscriptTurns(transcriptId, [turn])
}

/**
 * Atomic multi-turn append: same single `UPDATE ... SET turns = turns || $1::jsonb`
 * statement as the original per-turn append, just with the whole batch in one
 * statement so a Q&A pair (or any turn group) lands indivisibly — interleaved
 * writers can never split it.
 */
export async function appendTranscriptTurns(
  transcriptId: string,
  turns: TranscriptTurn[],
): Promise<Transcript | undefined> {
  const [row] = await db
    .update(transcriptsTable)
    .set({
      turns: sql`${transcriptsTable.turns} || ${JSON.stringify(turns)}::jsonb`,
    })
    .where(eq(transcriptsTable.id, transcriptId))
    .returning()
  return row
}
