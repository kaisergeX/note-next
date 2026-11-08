import assert from 'node:assert/strict'
import postgres from 'postgres'
import {drizzle} from 'drizzle-orm/postgres-js'
import {migrate} from 'drizzle-orm/postgres-js/migrator'

export async function openSearchTestDatabase() {
  const url = process.env.NOTES_TEST_DATABASE_URL
  assert.ok(
    url,
    'Use run-note-search-tests.mjs with a dedicated disposable database',
  )
  const parsed = new URL(url)
  assert.ok(
    ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) &&
      /_test(?:_|$)/.test(parsed.pathname),
  )
  if (process.env.DATABASE_URL)
    assert.notEqual(new URL(process.env.DATABASE_URL).pathname, parsed.pathname)
  const client = postgres(url, {max: 5, onnotice: () => {}})
  const db = drizzle({client})
  await migrate(db, {migrationsFolder: './drizzle'})
  return {client, db}
}
