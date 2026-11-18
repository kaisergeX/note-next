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
let sourceVault, sourceReceipts, acceptedRequest

async function snapshot(name) {
  const connection = postgres(database(name), {max: 1, onnotice() {}})
  try {
    const [vault] = await connection`SELECT * FROM note_vaults`
    const receipts =
      await connection`SELECT * FROM note_vault_operation_receipts ORDER BY operation_id`
    return {vault, receipts}
  } finally {
    await connection.end()
  }
}

function pgTool(name, args, input) {
  const result = spawnSync(
    'docker',
    ['compose', 'exec', '-T', 'postgres', name, ...args],
    {input, windowsHide: true, maxBuffer: 32 * 1024 * 1024, timeout: 30000},
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
    const done = once(preview, 'exit', {signal: AbortSignal.timeout(5000)})
    preview.kill()
    await done
  }
  preview = undefined
}
async function signedIn(owner, engine) {
  browser = await engine.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
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
  console.log('Backup rehearsal: source preview ready')
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
  console.log('Backup rehearsal: source vault activated')
  await page.getByLabel(v.passphrase, {exact: true}).fill(phrase)
  console.log('Backup rehearsal: primary entered')
  await button(page, v.unlock).click()
  console.log('Backup rehearsal: unlock submitted')
  await expect(button(page, v.lock)).toBeVisible()
  console.log('Backup rehearsal: source unlocked')
  await button(page, messages.note.encryption.create).click()
  const title = 'Recovery title ' + randomUUID()
  const body = 'Recovery body ' + randomUUID()
  const field = (p, name) => p.getByRole('textbox', {name, exact: true})
  await field(page, e.title).fill(title)
  await field(page, e.body).fill(body)
  await button(page, e.save).click()
  console.log('Backup rehearsal: source note save submitted')
  await expect(
    page.getByRole('status').filter({hasText: e.synced}),
  ).toBeVisible({timeout: 30000})
  await button(page, v.lock).click()
  await page.getByLabel(v.passphrase, {exact: true}).fill(phrase)
  await button(page, v.replacePassphrase).click()
  const changedPhrase = await page.locator('p.font-mono').first().innerText()
  await page
    .getByLabel(v.replacementConfirmation, {exact: true})
    .fill(changedPhrase)
  const [changed] = await Promise.all([
    page.waitForRequest(
      (r) =>
        new URL(r.url()).pathname === '/api/note-vault' &&
        r.method() === 'PATCH',
    ),
    button(page, v.confirmReplacement).click(),
  ])
  await expect(
    page.getByRole('status').filter({hasText: v.replacementChanged}),
  ).toBeVisible()
  acceptedRequest = changed.postDataJSON()
  const captured = await snapshot(source)
  sourceVault = captured.vault
  sourceReceipts = captured.receipts
  console.log('Backup rehearsal: source replacement and receipt captured')
  assert.equal(sourceVault.authorization_version, 1)
  assert.ok(sourceVault.authorization?.signerEnvelope)
  assert.equal(sourceReceipts.length, 1)
  await browser.close()
  browser = undefined
  await stop()
  console.log('Backup rehearsal: source preview stopped')

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
  const restoredState = await snapshot(restored)
  assert.deepEqual(restoredState.vault, sourceVault)
  assert.deepEqual(restoredState.receipts, sourceReceipts)
  console.log('Backup rehearsal: archive restored and pinned state verified')

  await start(restored)
  const fresh = await signedIn(owner, recoveryEngine)
  await fresh.goto(origin + '/en/collection/encrypted')
  await expect(button(fresh, v.useRecovery)).toBeVisible()
  await expect(button(fresh, v.lock)).toHaveCount(0)
  await button(fresh, v.useRecovery).click()
  await fresh.getByLabel(v.recoveryKey, {exact: true}).fill(kit)
  await button(fresh, v.unlock).click()
  await expect(button(fresh, v.lock)).toBeVisible()
  const exactRetry = await fresh.evaluate(async (request) => {
    const response = await fetch('/api/note-vault', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-note-encryption-protocol': '1',
      },
      body: JSON.stringify(request),
    })
    return response.json()
  }, acceptedRequest)
  assert.equal(exactRetry.status, 'success')
  assert.equal(exactRetry.alreadyApplied, true)
  assert.equal(
    exactRetry.receipt.appliedRevision,
    sourceReceipts[0].applied_revision,
  )
  await fresh.getByLabel(v.recoveryKey, {exact: true}).fill(kit)
  await button(fresh, v.replacePassphrase).click()
  const recoveredPhrase = await fresh.locator('p.font-mono').first().innerText()
  await fresh
    .getByLabel(v.replacementConfirmation, {exact: true})
    .fill(recoveredPhrase)
  await button(fresh, v.confirmReplacement).click()
  await expect(
    fresh.getByRole('status').filter({hasText: v.replacementChanged}),
  ).toBeVisible()
  const recoveredState = await snapshot(restored)
  assert.deepEqual(
    recoveredState.vault.authorization,
    sourceVault.authorization,
  )
  assert.deepEqual(
    recoveredState.vault.recovery_wrapper,
    sourceVault.recovery_wrapper,
  )
  assert.equal(recoveredState.receipts.length, 2)
  await button(fresh, v.lock).click()
  await expect(button(fresh, v.lock)).toHaveCount(0)
  await fresh.reload()
  await fresh.getByLabel(v.passphrase, {exact: true}).fill(recoveredPhrase)
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
    `PASS: Chromium creation, PostgreSQL archive restore and fresh ${recoveryEngine.name()} ${browser.version()} recovery. Pinned signer and receipts restored exactly; an accepted retry reconciled; the saved kit authorized a new primary with both flags closed; retained notes decrypted, an edit synced, and the note relocked.`,
  )
} finally {
  try {
    await browser?.close()
  } finally {
    try {
      await stop()
    } finally {
      try {
        for (const name of created)
          await admin`DROP DATABASE ${admin(name)} WITH (FORCE)`
        if (created.length) {
          const remaining = await admin`
            SELECT datname FROM pg_database WHERE datname IN ${admin(created)}
          `
          assert.equal(remaining.length, 0)
          console.log(
            'Backup rehearsal: generated databases removed and absence verified',
          )
        }
      } finally {
        await admin.end()
      }
    }
  }
}
