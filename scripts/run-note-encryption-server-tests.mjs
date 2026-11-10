import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {spawn} from 'node:child_process'
import postgres from 'postgres'
const app = new URL(process.env.DATABASE_URL)
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(app.hostname))
const name = `eton_test_encryption_${randomUUID().replaceAll('-', '')}`
const test = new URL(app)
test.pathname = `/${name}`
const adminUrl = new URL(app)
adminUrl.pathname = '/postgres'
const admin = postgres(adminUrl.toString(), {max: 1, onnotice: () => {}})
let created = false
try {
  await admin`CREATE DATABASE ${admin(name)}`
  created = true
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        '--conditions=react-server',
        '--import',
        'tsx',
        '--test',
        'scripts/note-encryption-server.test.ts',
      ],
      {
        stdio: 'inherit',
        env: {...process.env, NOTES_TEST_DATABASE_URL: test.toString()},
      },
    )
    child.on('error', reject)
    child.on('exit', (code) => resolve(code ?? 1))
  })
} finally {
  if (created) await admin`DROP DATABASE ${admin(name)}`
  await admin.end()
}
