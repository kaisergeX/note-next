import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {spawn, spawnSync} from 'node:child_process'
import {once} from 'node:events'
import {setTimeout as delay} from 'node:timers/promises'
import {resolve} from 'node:path'
import {chromium, expect, firefox, webkit} from '@playwright/test'
import postgres from 'postgres'
import {drizzle} from 'drizzle-orm/postgres-js'
import {migrate} from 'drizzle-orm/postgres-js/migrator'
import {encode} from 'next-auth/jwt'
import messages from '../dictionaries/en.json' with {type: 'json'}

// Run with the local Compose PostgreSQL service and a built production app.
// Only generated database names are passed to pg_dump, pg_restore and DROP.
// Optionally pass firefox or webkit to recover in a different browser engine.
const recoveryEngines = new Map([
  ['chromium', chromium],
  ['firefox', firefox],
  ['webkit', webkit],
])
const recoveryEngine = recoveryEngines.get(process.argv[2] ?? 'chromium')
assert.ok(
  recoveryEngine,
  'Expected recovery browser chromium, firefox, or webkit',
)
const instance = new URL(process.env.DATABASE_URL)
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(instance.hostname))
const adminUrl = new URL(instance)
adminUrl.pathname = '/postgres'
const admin = postgres(adminUrl.toString(), {max: 1, onnotice() {}})
const database = (name) => {
  const url = new URL(instance)
  url.pathname = '/' + name
  return url.toString()
}
const suffix = randomUUID().replaceAll('-', '')
const source = 'eton_test_backup_' + suffix
const restored = 'eton_test_restore_' + suffix
const created = []
const origin = 'http://localhost:3168'
const v = messages.note.vault
const e = messages.note.encryptedEditor
let preview, browser

function pgTool(name, args, input) {
  const result = spawnSync(
    'docker',
    ['compose', 'exec', '-T', 'postgres', name, ...args],
    {input, windowsHide: true, maxBuffer: 32 * 1024 * 1024},
  )
  if (result.status !== 0)
    throw new Error(
      name + ' failed: ' + (result.error?.message ?? result.stderr),
    )
  return result.stdout
}
async function start(name) {
  if (await fetch(origin + '/api/auth/session').catch(() => null))
    throw new Error('Backup rehearsal port is already in use')
  preview = spawn(
    process.execPath,
    [
      resolve('node_modules/next/dist/bin/next'),
      'start',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3168',
    ],
    {
      windowsHide: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        DATABASE_URL: database(name),
        POSTGRES_URL_NON_POOLING: database(name),
        AUTH_URL: origin,
        NEXTAUTH_URL: origin,
        NOTE_ENCRYPTION_ENROLLMENT_ENABLED: name === source ? 'true' : 'false',
        NOTE_ENCRYPTION_CREATION_ENABLED: name === source ? 'true' : 'false',
      },
    },
  )
  for (let i = 0; i < 100; i++) {
    assert.equal(preview.exitCode, null, 'Backup rehearsal preview exited')
    if ((await fetch(origin + '/api/auth/session').catch(() => null))?.ok)
      return
    await delay(200)
  }
  throw new Error('Backup rehearsal preview did not start')
}
async function stop() {
  if (preview && preview.exitCode === null && preview.signalCode === null) {
    const done = once(preview, 'exit')
    preview.kill()
    await done
  }
  preview = undefined
}
async function signedIn(owner, engine) {
  browser = await engine.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  const token = await encode({
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
    salt: 'authjs.session-token',
    token: {
      sub: owner.id,
      userId: owner.id,
      email: owner.email,
      role: owner.role,
    },
  })
  await context.addCookies([
    {name: 'authjs.session-token', value: token, url: origin, httpOnly: true},
  ])
  const session = await context.request.get(origin + '/api/auth/session')
  assert.equal((await session.json()).user?.id, owner.id)
  return page
}
try {
  for (const name of [source, restored]) {
    await admin`CREATE DATABASE ${admin(name)}`
    created.push(name)
  }
  const sql = postgres(database(source), {max: 1, onnotice() {}})
  let owner
  try {
    await migrate(drizzle({client: sql}), {migrationsFolder: './drizzle'})
    ;[owner] =
      await sql`INSERT INTO users (name,email) VALUES ('Backup fixture', ${randomUUID() + '@test.invalid'}) RETURNING id,email,role`
  } finally {
    await sql.end()
  }
  await start(source)
  const page = await signedIn(owner, chromium)
  const button = (p, name) => p.getByRole('button', {name, exact: true})
  await page.goto(origin + '/en/collection/encrypted')
  await button(page, v.setup).click()
  const phrase = await page.locator('p.font-mono').first().innerText()
  await button(page, v.reveal).click()
  const kit = await page.locator('p.font-mono').nth(1).innerText()
  const entry = page.getByLabel(v.confirmationEntry, {exact: true})
  await entry.fill(phrase)
  await button(page, v.verifyPrimary).click()
  await expect(button(page, v.primaryVerified)).toBeVisible()
  await entry.fill(kit)
  await button(page, v.verifyRecovery).click()
  await expect(button(page, v.recoveryVerified)).toBeVisible()
  const [activation] = await Promise.all([
    page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/note-vault' &&
        r.request().method() === 'POST',
    ),
    button(page, v.activate).click(),
  ])
  assert.equal((await activation.json()).status, 'success')
  await page.getByLabel(v.passphrase, {exact: true}).fill(phrase)
  await button(page, v.unlock).click()
  await button(page, messages.note.encryption.create).click()
  const title = 'Recovery title ' + randomUUID()
  const body = 'Recovery body ' + randomUUID()
  const field = (p, name) => p.getByRole('textbox', {name, exact: true})
  await field(page, e.title).fill(title)
  await field(page, e.body).fill(body)
  await button(page, e.save).click()
  await expect(
    page.getByRole('status').filter({hasText: e.synced}),
  ).toBeVisible({timeout: 30000})
  await browser.close()
  browser = undefined
  await stop()

  const user = decodeURIComponent(instance.username)
  const dump = pgTool('pg_dump', ['-U', user, '-Fc', '-d', source])
  assert.equal(dump.subarray(0, 5).toString(), 'PGDMP')
  pgTool(
    'pg_restore',
    [
      '-U',
      user,
      '--exit-on-error',
      '--single-transaction',
      '--no-owner',
      '-d',
      restored,
    ],
    dump,
  )
  dump.fill(0)

  await start(restored)
  const fresh = await signedIn(owner, recoveryEngine)
  await fresh.goto(origin + '/en/collection/encrypted')
  await expect(button(fresh, v.useRecovery)).toBeVisible()
  await expect(button(fresh, v.lock)).toHaveCount(0)
  await button(fresh, v.useRecovery).click()
  await fresh.getByLabel(v.recoveryKey, {exact: true}).fill(kit)
  await button(fresh, v.unlock).click()
  await button(fresh, title).click()
  await expect(field(fresh, e.title)).toHaveText(title)
  await expect(field(fresh, e.body)).toHaveText(body)
  await field(fresh, e.body).fill(body + ' after restore')
  await button(fresh, e.save).click()
  await expect(
    fresh.getByRole('status').filter({hasText: e.synced}),
  ).toBeVisible({timeout: 30000})
  await button(fresh, v.lock).click()
  await expect(field(fresh, e.body)).toHaveCount(0)
  console.log(
    `PASS: Chromium creation, PostgreSQL archive restore and fresh ${recoveryEngine.name()} ${browser.version()} recovery. The saved kit recovered the exact title and body, an edit synced with enrollment and creation disabled, and the note relocked.`,
  )
} finally {
  await browser?.close()
  await stop()
  try {
    for (const name of created)
      await admin`DROP DATABASE ${admin(name)} WITH (FORCE)`
  } finally {
    await admin.end()
  }
}
