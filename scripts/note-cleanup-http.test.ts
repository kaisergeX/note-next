import assert from 'node:assert/strict'
import {randomBytes, randomUUID} from 'node:crypto'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {setTimeout as delay} from 'node:timers/promises'
import {test} from 'node:test'
import postgres from 'postgres'
import {drizzle} from 'drizzle-orm/postgres-js'
import {migrate} from 'drizzle-orm/postgres-js/migrator'
import {inArray, sql} from 'drizzle-orm'
import {notesTable} from '../db/schema/notes'
import {usersTable} from '../db/schema/users'

// Starts the built app against a disposable database, never the app/production DB.
// Run separately from test:notes because this endpoint sweeps every expired row.
test(
  'production cleanup endpoint authenticates, bounds real deletions, invalidates tags, and tolerates retry',
  {timeout: 60_000},
  async () => {
    const url = process.env.NOTES_TEST_DATABASE_URL
    assert.ok(
      url,
      'Set NOTES_TEST_DATABASE_URL to a disposable local _test database',
    )
    const parsed = new URL(url)
    assert.ok(
      ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) &&
        /_test(?:_|$)/.test(parsed.pathname),
    )
    if (process.env.DATABASE_URL)
      assert.notEqual(
        new URL(process.env.DATABASE_URL).pathname,
        parsed.pathname,
      )
    const client = postgres(url, {max: 2, onnotice: () => {}})
    const db = drizzle({client})
    const secret = randomBytes(32).toString('hex')
    const port = 3002
    const origin = `http://127.0.0.1:${port}`
    const owners: string[] = []
    let server: ReturnType<typeof spawn> | undefined
    try {
      await migrate(db, {migrationsFolder: './drizzle'})
      // Refuse to attach to an unrelated process already using this port.
      let occupied = false
      try {
        await fetch(origin)
        occupied = true
      } catch {
        // Connection refusal means the isolated port is available.
      }
      assert.equal(
        occupied,
        false,
        'Port 3002 must be free for the isolated test server',
      )
      server = spawn(
        process.execPath,
        ['node_modules/next/dist/bin/next', 'start', '--port', String(port)],
        {
          env: {
            ...process.env,
            DATABASE_URL: url,
            CRON_SECRET: secret,
            NODE_ENV: 'production',
          },
          stdio: 'ignore',
        },
      )
      const endpoint = `${origin}/api/cron/note-cleanup`
      let ready = false
      for (let attempt = 0; attempt < 100; attempt++) {
        assert.equal(
          server.exitCode,
          null,
          'Isolated production server exited before readiness',
        )
        try {
          if ((await fetch(endpoint)).status === 401) {
            ready = true
            break
          }
        } catch {
          // The server may not have bound its port yet.
        }
        await delay(100)
      }
      assert.ok(ready, 'Build the app before running this test')
      const run = randomUUID()
      const users = await db
        .insert(usersTable)
        .values([
          {name: 'Cleanup A', email: `cleanup-a-${run}@test.invalid`},
          {name: 'Cleanup B', email: `cleanup-b-${run}@test.invalid`},
        ])
        .returning({id: usersTable.id})
      owners.push(...users.map((user) => user.id))
      const rows = await db
        .insert(notesTable)
        .values([
          {authorId: owners[0], title: 'Surviving active fixture'},
          {
            authorId: owners[1],
            pendingDeleteAt: sql`statement_timestamp() + interval '1 day'`,
          },
          ...Array.from({length: 501}, (_, i) => ({
            authorId: owners[i % 2],
            pendingDeleteAt: sql`statement_timestamp() - interval '45 days'`,
          })),
        ])
        .returning({id: notesTable.id})
      const authorization = {authorization: `Bearer ${secret}`}
      for (const response of [
        await fetch(endpoint, {headers: {authorization: 'Bearer wrong'}}),
        await fetch(endpoint, {headers: authorization, method: 'HEAD'}),
      ])
        assert.ok([401, 405].includes(response.status))
      assert.equal(
        (
          await db
            .select()
            .from(notesTable)
            .where(inArray(notesTable.authorId, owners))
        ).length,
        503,
      )
      const first = await fetch(endpoint, {headers: authorization})
      assert.equal(first.status, 200)
      assert.match(
        first.headers.get('cache-control') ?? '',
        /private.*no-store/,
      )
      assert.deepEqual(await first.json(), {
        ok: true,
        deleted: 500,
        batches: 5,
        bounded: true,
      })
      const retry = await fetch(endpoint, {headers: authorization})
      assert.deepEqual(await retry.json(), {
        ok: true,
        deleted: 1,
        batches: 1,
        bounded: false,
      })
      const duplicate = await fetch(endpoint, {headers: authorization})
      assert.deepEqual(await duplicate.json(), {
        ok: true,
        deleted: 0,
        batches: 1,
        bounded: false,
      })
      const survivors = await db
        .select({id: notesTable.id})
        .from(notesTable)
        .where(inArray(notesTable.authorId, owners))
      assert.deepEqual(
        new Set(survivors.map((row) => row.id)),
        new Set(rows.slice(0, 2).map((row) => row.id)),
      )
    } finally {
      if (server && server.exitCode === null) {
        const exited = once(server, 'exit')
        server.kill('SIGTERM')
        await exited
      }
      try {
        if (owners.length) {
          await db
            .delete(notesTable)
            .where(inArray(notesTable.authorId, owners))
          await db.delete(usersTable).where(inArray(usersTable.id, owners))
        }
      } finally {
        await client.end()
      }
    }
  },
)
