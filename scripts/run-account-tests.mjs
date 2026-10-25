import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {spawn} from 'node:child_process'
import postgres from 'postgres'

// This runner only creates/drops its own disposable database on the local
// development instance. Never migrate or delete fixtures in the app database.
const appUrl = new URL(process.env.DATABASE_URL)
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(appUrl.hostname),
  'Account tests require a local PostgreSQL instance',
)
const name = `eton_test_account_${randomUUID().replaceAll('-', '')}`
const testUrl = new URL(appUrl)
testUrl.pathname = `/${name}`
const adminUrl = new URL(appUrl)
adminUrl.pathname = '/postgres'
const admin = postgres(adminUrl.toString(), {max: 1, onnotice: () => {}})
let created = false
try {
  await admin`CREATE DATABASE ${admin(name)}`
  created = true
  const args = [
    '--conditions=react-server',
    '--import',
    'tsx',
    '--test',
    '--test-concurrency=1',
    'scripts/account-deletion.test.ts',
    'scripts/account-policy.test.ts',
    'scripts/note-recovery.test.ts',
    'scripts/note-mutation.test.ts',
    'scripts/note-cleanup.test.ts',
  ]
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      env: {...process.env, NOTES_TEST_DATABASE_URL: testUrl.toString()},
    })
    child.on('error', reject)
    child.on('exit', resolve)
  })
  process.exitCode = code ?? 1
} finally {
  if (created) await admin`DROP DATABASE ${admin(name)}`
  await admin.end()
}
