import assert from 'node:assert/strict'
import {test} from 'node:test'
import {performNoteMutation} from '../lib/notes/client-mutation'
import {noteMutationSucceeded} from '../lib/notes/lifecycle'

test('transport failures become retryable outcomes so callers retain drafts and items', async () => {
  const result = await performNoteMutation(async () => {
    throw new TypeError('Failed to fetch')
  })
  assert.deepEqual(result, {status: 'retryable_error'})
  assert.equal(noteMutationSucceeded(result), false)
})
test('server refusals remain failures rather than closing the editor as success', async () => {
  for (const status of [
    'unavailable',
    'invalid_input',
    'conflict',
    'retryable_error',
  ] as const) {
    const result = await performNoteMutation(async () => ({status}))
    assert.equal(result.status, status)
    assert.equal(noteMutationSucceeded(result), false)
  }
})

test('authenticated note paths bypass service-worker caching, including HTML and RSC keys', async () => {
  const {isNoteNetworkPath} = await import('../lib/notes/network-policy')
  for (const path of [
    '/eton',
    '/en/eton/id',
    '/vi/trash',
    '/trash/id',
    '/en/full/eton/id',
    '/api/note/id',
    '/api/cron/note-cleanup',
    '/en/trash.rsc',
    '/vi/eton.html',
  ])
    assert.equal(isNoteNetworkPath(path), true, path)
  for (const path of [
    '/',
    '/en',
    '/etonic',
    '/trashcan',
    '/api/notes',
    '/api/cron/note-cleanup-other',
    '/_next/static/chunk.js',
    '/en/settings/appearance',
  ])
    assert.equal(isNoteNetworkPath(path), false, path)
})

test('trash summaries stay plain text with readable entities and no script/style contents', async () => {
  const {noteText} = await import('../lib/notes/text')
  assert.equal(
    noteText(
      '<p>A &amp; B &#128221;</p><script>alert(1)</script><style>body{}</style>',
    ),
    'A & B 📝',
  )
  assert.equal(noteText(null), '')
  assert.equal(noteText('<img src=x onerror=alert(1)>hello'), 'hello')
})

test('precache excludes unresolved route templates and protected note pages', async () => {
  const {isPrecacheablePath} = await import('../lib/notes/network-policy')
  for (const path of [
    '/[locale]/trash',
    '/en/[...rest]',
    '/%5Blocale%5D',
    '/en/trash',
    '/en/eton',
    '/api/cron/note-cleanup',
  ])
    assert.equal(isPrecacheablePath(path), false)
  for (const path of ['/_next/static/chunks/editor.js', '/favicon.svg', '/en'])
    assert.equal(isPrecacheablePath(path), true)
})
