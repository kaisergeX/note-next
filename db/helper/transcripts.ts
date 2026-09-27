import {and, desc, eq, isNull, sql} from 'drizzle-orm'
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
  const [row] = await db
    .update(transcriptsTable)
    .set({
      turns: sql`${transcriptsTable.turns} || ${JSON.stringify([turn])}::jsonb`,
    })
    .where(eq(transcriptsTable.id, transcriptId))
    .returning()
  return row
}
