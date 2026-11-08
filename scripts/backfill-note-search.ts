import assert from 'node:assert/strict'
import postgres from 'postgres'
import {drizzle} from 'drizzle-orm/postgres-js'
import {sql} from 'drizzle-orm'
import {backfillNoteSearch} from '../db/repositories/note-search'

// Run after db:migrate, before enabling search. Restarting safely resumes only
// missing rows; notes/revisions are never changed. No HTML/content is logged.
assert.ok(
  process.env.DATABASE_URL,
  'Set DATABASE_URL for the intended deployment',
)
const client = postgres(process.env.DATABASE_URL, {max: 1})
const db = drizzle({client})
try {
  let total = 0
  let batch: number
  do {
    batch = await backfillNoteSearch(db)
    total += batch
    console.log(`Search documents prepared: ${total}`)
  } while (batch)
  const [remaining] = await db.execute<{count: number}>(sql`
    SELECT count(*)::integer AS count FROM notes n
    LEFT JOIN note_search_documents d ON d.note_id = n.id
    WHERE d.note_id IS NULL`)
  assert.equal(
    remaining.count,
    0,
    'Search backfill incomplete; rerun before enabling search',
  )
  console.log('Verified: no notes missing search documents')
} finally {
  await client.end()
}
