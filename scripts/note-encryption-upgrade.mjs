import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {spawn} from 'node:child_process'
import {once} from 'node:events'
import {setTimeout as delay} from 'node:timers/promises'
import {resolve} from 'node:path'
import postgres from 'postgres'
import {drizzle} from 'drizzle-orm/postgres-js'
import {migrate} from 'drizzle-orm/postgres-js/migrator'
import {encode} from 'next-auth/jwt'
import {chromium, expect} from '@playwright/test'
import messages from '../dictionaries/en.json' with {type: 'json'}

const baseline = resolve('.playwright-mcp/release-baseline')
const origin = 'http://localhost:3154'
const instance = new URL(process.env.DATABASE_URL)
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(instance.hostname))
instance.pathname = '/postgres'
const admin = postgres(instance.toString(), {max: 1, onnotice: () => {}})
const name = `eton_test_upgrade_${randomUUID().replaceAll('-', '')}`
await admin`CREATE DATABASE ${admin(name)}`
const url = new URL(instance)
url.pathname = `/${name}`
const client = postgres(url.toString(), {max: 2, onnotice: () => {}})
let server, browser
async function stop() {
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit')
    server.kill('SIGTERM')
    await exited
  }
  server = undefined
}
async function start(path) {
  try {
    await fetch(`${origin}/api/auth/session`)
    assert.fail('Upgrade test port is occupied')
  } catch (error) {
    if (error.code === 'ERR_ASSERTION') throw error
  }
  const env = {
    ...process.env,
    DATABASE_URL: url.toString(),
    POSTGRES_URL_NON_POOLING: url.toString(),
    AUTH_URL: origin,
    NEXTAUTH_URL: origin,
    NOTE_ENCRYPTION_ENROLLMENT_ENABLED: 'false',
    NOTE_ENCRYPTION_CREATION_ENABLED: 'false',
  }
  delete env.NODE_OPTIONS
  server = spawn(
    process.execPath,
    [
      resolve('node_modules/next/dist/bin/next'),
      'start',
      path,
      '--port',
      '3154',
    ],
    {env, stdio: 'ignore'},
  )
  for (let attempt = 0; attempt < 100; attempt++) {
    assert.equal(server.exitCode, null, 'Preview exited before readiness')
    try {
      if ((await fetch(`${origin}/api/auth/session`)).ok) return
    } catch {
      /* Not bound yet. */
    }
    await delay(100)
  }
  throw Error('Preview did not become ready')
}
const content = (page) =>
  page.getByRole('textbox', {name: 'Note content', exact: true})
try {
  await migrate(drizzle({client}), {migrationsFolder: `${baseline}/drizzle`})
  const [owner] =
    await client`INSERT INTO users (name, email) VALUES ('Synthetic upgrade owner', ${`${randomUUID()}@test.invalid`}) RETURNING *`
  const notes =
    await client`INSERT INTO notes (author_id, title, content, pending_deleted_at) VALUES
    (${owner.id}, '<p>Upgrade draft</p>', '<p>Original draft</p>', null),
    (${owner.id}, '<p>Upgrade old client</p>', '<p>Original old client</p>', null),
    (${owner.id}, '<p>Upgrade trashed</p>', '<p>Original trash</p>', now() + interval '1 day') RETURNING *`
  await start(baseline)
  browser = await chromium.launch()
  const old = await browser.newContext({serviceWorkers: 'block'})
  const upgraded = await browser.newContext({serviceWorkers: 'block'})
  const token = await encode({
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    salt: 'authjs.session-token',
    token: {
      sub: 'upgrade-fixture',
      userId: owner.id,
      email: owner.email,
      role: owner.role,
    },
  })
  for (const context of [old, upgraded])
    await context.addCookies([
      {
        name: 'authjs.session-token',
        value: token,
        url: origin,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])
  const page = await upgraded.newPage()
  await page.goto(`${origin}/en/full/eton/${notes[0].id}`)
  await content(page).fill('Saved by baseline client')
  await expect
    .poll(
      async () =>
        (await client`SELECT content FROM notes WHERE id = ${notes[0].id}`)[0]
          .content,
    )
    .toBe('<p>Saved by baseline client</p>')
  await upgraded.setOffline(true)
  await content(page).fill('Unsynced baseline browser draft')
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const db = await new Promise((resolve, reject) => {
          const open = indexedDB.open('etoN-note-recovery')
          open.onsuccess = () => resolve(open.result)
          open.onerror = () => reject(open.error)
        })
        try {
          return await new Promise((resolve, reject) => {
            const read = db.transaction('drafts').objectStore('drafts').getAll()
            read.onsuccess = () =>
              resolve(
                read.result.some(
                  (row) =>
                    row.draft.content ===
                    '<p>Unsynced baseline browser draft</p>',
                ),
              )
            read.onerror = () => reject(read.error)
          })
        } finally {
          db.close()
        }
      }),
    )
    .toBe(true)
  await page.close()
  const oldPage = await old.newPage()
  await oldPage.goto(`${origin}/en/full/eton/${notes[1].id}`)
  await expect(content(oldPage)).toBeVisible()
  await oldPage.route('**/api/note/sync', (route) => route.abort('failed'))
  await content(oldPage).fill('Previous client after server upgrade')
  await expect(
    oldPage.getByRole('button', {name: 'Retry', exact: true}),
  ).toBeVisible()
  await stop()
  await migrate(drizzle({client}), {migrationsFolder: './drizzle'})
  await start(process.cwd())
  const legacyHeaders = []
  oldPage.on('request', (request) => {
    if (
      request.url().endsWith('/api/note/sync') &&
      request.method() === 'POST'
    ) {
      legacyHeaders.push(request.headers()['x-note-encryption-protocol'])
    }
  })
  await oldPage.unroute('**/api/note/sync')
  await oldPage.getByRole('button', {name: 'Retry', exact: true}).click()
  await expect
    .poll(
      async () =>
        (await client`SELECT content FROM notes WHERE id = ${notes[1].id}`)[0]
          .content,
      {timeout: 30_000},
    )
    .toBe('<p>Previous client after server upgrade</p>')
  assert.ok(legacyHeaders.length > 0)
  assert.ok(legacyHeaders.every((header) => header === undefined))
  await upgraded.setOffline(false)
  const candidate = await upgraded.newPage()
  await candidate.goto(`${origin}/en/full/eton/${notes[0].id}`)
  await expect(content(candidate)).toHaveText('Unsynced baseline browser draft')
  await expect
    .poll(
      async () =>
        (await client`SELECT content FROM notes WHERE id = ${notes[0].id}`)[0]
          .content,
      {timeout: 30_000},
    )
    .toBe('<p>Unsynced baseline browser draft</p>')
  await candidate.goto(`${origin}/en/collection/trash`)
  await candidate
    .getByRole('button', {
      name: messages.note.trash.previewNamed.replace(
        '{title}',
        'Upgrade trashed',
      ),
      exact: true,
    })
    .click()
  const preview = candidate.getByRole('dialog', {
    name: 'Upgrade trashed',
    exact: true,
  })
  await expect(preview.getByRole('textbox')).toHaveText('Original trash')
  await expect(preview.getByRole('textbox')).toHaveAttribute(
    'contenteditable',
    'false',
  )
  const [trash] = await client`SELECT * FROM notes WHERE id = ${notes[2].id}`
  assert.deepEqual(trash.pending_deleted_at, notes[2].pending_deleted_at)
  assert.equal(
    (
      await client`SELECT count(*)::int AS count FROM note_vaults WHERE owner_id = ${owner.id}`
    )[0].count,
    0,
  )
  console.log(
    JSON.stringify({
      baseline: '609afe5a9c24af2d0850e0b35c7c9a0e05fc5c1e',
      flags: {enrollment: false, creation: false},
      baselineOrdinarySave: 'passed',
      oldClientToNewServerWithoutProtocolHeader: 'passed',
      upgradedClientOldUnsyncedDraft: 'passed',
      upgradedTrashPreviewAndDeadline: 'passed',
      result: 'passed',
    }),
  )
} finally {
  if (browser) await browser.close()
  await stop()
  await client.end()
  await admin`DROP DATABASE ${admin(name)}`
  await admin.end()
}
