import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFile} from 'node:fs/promises'
import {
  handleNoteCleanup,
  runNoteCleanup,
  NOTE_CLEANUP_BATCH_SIZE,
  NOTE_CLEANUP_MAX_BATCHES,
  NOTE_CLEANUP_BUDGET_MS,
  type DeletedNoteIdentity,
} from '../lib/notes/cleanup'
import {getNoteMutationCacheKeys} from '../db/helper'

const secret = 'test-only-secret-not-used-for-deployment'
const identity = {id: 'note', authorId: 'owner'}
const request = (authorization?: string, method = 'GET') =>
  new Request('http://localhost/api/cron/note-cleanup', {
    method,
    headers: authorization ? {authorization} : {},
  })

test('cleanup endpoint fails closed before touching the database; HEAD cannot run cleanup', async () => {
  let calls = 0
  const dependencies = {
    deleteBatch: async () => {
      calls++
      return []
    },
    invalidateTag: () => {},
    log: () => {},
  }
  for (const authorization of [
    undefined,
    'Bearer wrong',
    `Basic ${secret}`,
    `Bearer ${secret}extra`,
  ]) {
    const response = await handleNoteCleanup(request(authorization), {
      ...dependencies,
      secret,
    })
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
  }
  assert.equal(
    (
      await handleNoteCleanup(request('Bearer undefined'), {
        ...dependencies,
        secret: undefined,
      })
    ).status,
    503,
  )
  assert.equal(
    (
      await handleNoteCleanup(request(`Bearer ${secret}`, 'HEAD'), {
        ...dependencies,
        secret,
      })
    ).status,
    405,
  )
  assert.equal(
    (
      await handleNoteCleanup(request(`Bearer ${secret}`, 'POST'), {
        ...dependencies,
        secret,
      })
    ).status,
    405,
  )
  assert.equal(calls, 0)
})

test('cleanup invalidates owner list/trash/detail tags, deduplicates them, and reports counts only', async () => {
  const tags: string[] = []
  const logs: unknown[] = []
  const rows = [
    identity,
    {id: 'another-note', authorId: 'owner'},
    {id: 'foreign-note', authorId: 'other'},
  ]
  const response = await handleNoteCleanup(request(`Bearer ${secret}`), {
    secret,
    deleteBatch: async (limit, beforeCommit) => {
      assert.equal(limit, NOTE_CLEANUP_BATCH_SIZE)
      beforeCommit(rows)
      return rows
    },
    invalidateTag: (tag) => {
      tags.push(tag)
    },
    log: (result) => {
      logs.push(result)
    },
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    deleted: 3,
    batches: 1,
    bounded: false,
  })
  assert.deepEqual(
    new Set(tags),
    new Set(
      rows.flatMap((row) => getNoteMutationCacheKeys(row.authorId, row.id)),
    ),
  )
  assert.equal(tags.length, new Set(tags).size)
  assert.deepEqual(logs, [{ok: true, deleted: 3, batches: 1, bounded: false}])
})

test('cleanup bounds batch count and elapsed work; later runs can drain a backlog', async () => {
  let remaining = NOTE_CLEANUP_BATCH_SIZE * NOTE_CLEANUP_MAX_BATCHES + 1
  const deleteBatch = async (
    limit: number,
    beforeCommit: (rows: DeletedNoteIdentity[]) => void,
  ) => {
    const rows = Array.from(
      {length: Math.min(limit, remaining)},
      () => identity,
    )
    beforeCommit(rows)
    remaining -= rows.length
    return rows
  }
  const dependencies = {deleteBatch, invalidateTag: () => {}}
  assert.deepEqual(await runNoteCleanup(dependencies), {
    ok: true,
    deleted: 500,
    batches: 5,
    bounded: true,
  })
  assert.equal(remaining, 1)
  assert.deepEqual(await runNoteCleanup(dependencies), {
    ok: true,
    deleted: 1,
    batches: 1,
    bounded: false,
  })
  let clock = 0
  remaining = 500
  const result = await runNoteCleanup({
    ...dependencies,
    now: () => clock,
    deleteBatch: async (limit, beforeCommit) => {
      const rows = await deleteBatch(limit, beforeCommit)
      clock += NOTE_CLEANUP_BUDGET_MS
      return rows
    },
  })
  assert.deepEqual(result, {ok: true, deleted: 100, batches: 1, bounded: true})
})

test('cleanup failure reports partial committed counts without exposing exception contents', async () => {
  let calls = 0
  const response = await handleNoteCleanup(request(`Bearer ${secret}`), {
    secret,
    deleteBatch: async (_, beforeCommit) => {
      if (calls++)
        throw new Error('SQL containing private note body and credentials')
      const rows = Array.from({length: NOTE_CLEANUP_BATCH_SIZE}, () => identity)
      beforeCommit(rows)
      return rows
    },
    invalidateTag: () => {},
    log: (result) => {
      assert.equal(JSON.stringify(result).includes('private'), false)
    },
  })
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), {
    ok: false,
    deleted: 100,
    batches: 1,
    bounded: false,
  })
})

test('deployment schedules one daily cleanup invocation at the protected route', async () => {
  const config = JSON.parse(
    await readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
  )
  assert.deepEqual(config.crons, [
    {path: '/api/cron/note-cleanup', schedule: '0 3 * * *'},
  ])
})
