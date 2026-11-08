import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {spawn} from 'node:child_process'
import postgres from 'postgres'

// Only the disposable database is migrated/seeded/dropped. The app database is
// never connected to; its URL supplies local instance credentials only.
const appUrl = new URL(process.env.DATABASE_URL)
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(appUrl.hostname))
const name = `eton_test_search_${randomUUID().replaceAll('-', '')}`
const testUrl = new URL(appUrl)
testUrl.pathname = `/${name}`
const adminUrl = new URL(appUrl)
adminUrl.pathname = '/postgres'
const admin = postgres(adminUrl.toString(), {max: 1, onnotice: () => {}})
let created = false
try {
  await admin`CREATE DATABASE ${admin(name)}`
  created = true
  const args = ['--conditions=react-server', '--import', 'tsx']
  if (process.argv.includes('--benchmark'))
    args.push('scripts/note-search-benchmark.ts')
  else
    args.push(
      '--test',
      '--test-concurrency=1',
      'scripts/note-search.test.ts',
      'scripts/note-recovery.test.ts',
      'scripts/account-deletion.test.ts',
    )
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      env: {...process.env, NOTES_TEST_DATABASE_URL: testUrl.toString()},
    })
    child.on('error', reject)
    child.on('exit', (code) => resolve(code ?? 1))
  })
} finally {
  if (created) await admin`DROP DATABASE ${admin(name)}`
  await admin.end()
}
