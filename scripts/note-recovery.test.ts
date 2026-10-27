import assert from 'node:assert/strict'
import {after, before, test} from 'node:test'
import {setTimeout as delay} from 'node:timers/promises'
import {randomUUID} from 'node:crypto'
import {drizzle} from 'drizzle-orm/postgres-js'
import {migrate} from 'drizzle-orm/postgres-js/migrator'
import {eq, inArray, sql} from 'drizzle-orm'
import postgres from 'postgres'
import {createNoteRepository} from '../db/repositories/notes'
import {notesTable} from '../db/schema/notes'
import {usersTable} from '../db/schema/users'
import {
  noteMutationSucceeded,
  NOTE_RETENTION_SECONDS,
  type NoteMutationResult,
} from '../lib/notes/lifecycle'
import {getNoteMutationCacheKeys} from '../db/helper'
import {createNoteCleanupRepository} from '../db/repositories/note-cleanup'
import {snapshot, type SyncRequest, type SyncResult} from '../lib/notes/sync'

const url = process.env.NOTES_TEST_DATABASE_URL
assert.ok(
  url,
  'Set NOTES_TEST_DATABASE_URL to a dedicated disposable loopback PostgreSQL database (name must contain _test). Never use DATABASE_URL.',
)
const parsed = new URL(url)
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) &&
    /_test(?:_|$)/.test(parsed.pathname),
  'Refusing to migrate a database not explicitly named as a local test database',
)
if (process.env.DATABASE_URL)
  assert.notEqual(new URL(process.env.DATABASE_URL).pathname, parsed.pathname)
const client = postgres(url, {max: 5, onnotice: () => {}})
const db = drizzle({client})
const repo = createNoteRepository(db)
const cleanup = createNoteCleanupRepository(db)
const owners: string[] = []
let alice: string
let bob: string

function success(result: NoteMutationResult) {
  assert.ok(noteMutationSucceeded(result), result.status)
  return result.note
}
async function fixture() {
  return success(
    await repo.createNote(alice, {
      title: '<p>Original</p>',
      content: '<p>Body</p>',
      theme: 'green',
    }),
  )
}

function synced(result: SyncResult) {
  assert.equal(result.status, 'success')
  if (result.status !== 'success')
    throw new Error('Expected sync acknowledgement')
  return result.note
}
function saveRequest(note?: ReturnType<typeof synced>): SyncRequest {
  return {
    ownerId: alice,
    creationId: randomUUID(),
    mutationId: randomUUID(),
    noteId: note?.id ?? null,
    expectedRevision: note?.revision ?? null,
    content: note
      ? snapshot(note)
      : {title: '<p>Autosave fixture</p>', content: '<p>Body</p>', theme: null},
    kind: 'save',
  }
}

test('stable creation/update retries acknowledge committed saves without extra notes or revisions', async () => {
  const create = saveRequest()
  const first = synced(await repo.syncNote(alice, create))
  const retry = synced(await repo.syncNote(alice, create))
  assert.equal(first.id, retry.id)
  assert.equal(first.revision, retry.revision)
  const update = {
    ...saveRequest(first),
    content: {...snapshot(first), content: '<p>New body</p>'},
  }
  const saved = synced(await repo.syncNote(alice, update))
  assert.notEqual(saved.revision, first.revision)
  const repeated = synced(await repo.syncNote(alice, update))
  assert.equal(repeated.revision, saved.revision)
})

test('stale revisions and repeated stale resolutions preserve the current server value', async () => {
  const first = synced(await repo.syncNote(alice, saveRequest()))
  const a = {
    ...saveRequest(first),
    content: {...snapshot(first), title: '<p>First writer</p>'},
  }
  const saved = synced(await repo.syncNote(alice, a))
  const stale = {
    ...saveRequest(first),
    content: {...snapshot(first), title: '<p>Stale writer</p>'},
  }
  const conflict = await repo.syncNote(alice, stale)
  assert.equal(conflict.status, 'conflict')
  const second = synced(
    await repo.syncNote(alice, {
      ...saveRequest(saved),
      content: {...snapshot(saved), title: '<p>Changed during review</p>'},
    }),
  )
  assert.equal(
    (await repo.syncNote(alice, {...stale, expectedRevision: saved.revision}))
      .status,
    'conflict',
  )
  assert.equal((await repo.getNote(alice, first.id))?.revision, second.revision)
})

test('all lifecycle updates advance revisions and old create retries never resurrect deleted notes', async () => {
  const create = saveRequest()
  const first = synced(await repo.syncNote(alice, create))
  const trashed = success(await repo.moveNoteToTrash(alice, first.id))
  assert.notEqual(trashed.revision, first.revision)
  assert.equal((await repo.syncNote(alice, create)).status, 'unavailable')
  const restored = success(
    await repo.restoreNote(alice, first.id, trashed.deadlineToken),
  )
  assert.notEqual(restored.revision, trashed.revision)
  assert.equal(
    (
      await repo.syncNote(alice, {
        ...saveRequest(first),
        content: {...snapshot(first), title: 'Old editor'},
      })
    ).status,
    'conflict',
  )
  const trashAgain = success(await repo.moveNoteToTrash(alice, first.id))
  success(
    await repo.permanentlyDeleteTrashedNote(
      alice,
      first.id,
      trashAgain.deadlineToken,
    ),
  )
  assert.equal((await repo.syncNote(alice, create)).status, 'unavailable')
  assert.equal(await repo.getNote(alice, first.id), null)
})

test('sync refuses another rendered account, foreign notes, and empty structural creates', async () => {
  assert.equal(
    (await repo.syncNote(bob, saveRequest())).status,
    'account_changed',
  )
  assert.equal(
    (
      await repo.syncNote(alice, {
        ...saveRequest(),
        content: {title: null, content: '<p><br></p>', theme: 'green'},
      })
    ).status,
    'invalid_input',
  )
  const first = synced(await repo.syncNote(alice, saveRequest()))
  assert.equal(
    (await repo.syncNote(bob, {...saveRequest(first), ownerId: bob})).status,
    'unavailable',
  )
})

test('editor Trash checks its revision, and lost Trash acknowledgement retries preserve the deadline', async () => {
  const first = synced(await repo.syncNote(alice, saveRequest()))
  const latest = synced(
    await repo.syncNote(alice, {
      ...saveRequest(first),
      content: {...snapshot(first), title: 'Newer title'},
    }),
  )
  assert.equal(
    (await repo.syncNote(alice, {...saveRequest(first), kind: 'trash'})).status,
    'conflict',
  )
  const request = {...saveRequest(latest), kind: 'trash' as const}
  const trashed = synced(await repo.syncNote(alice, request))
  const retry = synced(await repo.syncNote(alice, request))
  assert.equal(retry.revision, trashed.revision)
  assert.deepEqual(retry.pendingDeleteAt, trashed.pendingDeleteAt)
})

before(async () => {
  const migration = await migrate(db, {migrationsFolder: './drizzle'})
  assert.equal(migration, undefined, 'Test migrations must complete')
  const run = randomUUID()
  const rows = await db
    .insert(usersTable)
    .values([
      {name: 'Recovery Alice', email: `alice-${run}@test.invalid`},
      {name: 'Recovery Bob', email: `bob-${run}@test.invalid`},
    ])
    .returning()
  owners.push(...rows.map((row) => row.id))
  ;[alice, bob] = owners
})
after(async () => {
  try {
    if (owners.length) {
      await db.delete(notesTable).where(inArray(notesTable.authorId, owners))
      await db.delete(usersTable).where(inArray(usersTable.id, owners))
    }
  } finally {
    await client.end()
  }
})

test('two owners: creation cannot forge ownership or lifecycle fields; generic edits are strict', async () => {
  for (const extra of [
    {authorId: bob},
    {pendingDeleteAt: new Date()},
    {id: randomUUID()},
    {createdAt: new Date()},
    {updatedAt: new Date()},
    {isArchived: true},
    {isEncrypted: true},
    {unknown: true},
  ]) {
    assert.equal(
      (await repo.createNote(alice, {title: 'Forged', ...extra})).status,
      'invalid_input',
    )
  }
  const note = await fixture()
  assert.equal(note.authorId, alice)
  assert.equal(note.pendingDeleteAt, null)
  for (const extra of [
    {authorId: bob},
    {pendingDeleteAt: null},
    {id: randomUUID()},
    {updatedAt: new Date()},
    {isArchived: false},
    {isEncrypted: true},
    {unknown: true},
  ]) {
    assert.equal(
      (await repo.updateNote(alice, note.id, {title: 'Bad', ...extra})).status,
      'invalid_input',
    )
  }
  for (const input of [
    {},
    {title: 'a'.repeat(766)},
    {title: 1},
    {theme: 'invalid'},
    {content: []},
  ]) {
    assert.equal(
      (await repo.updateNote(alice, note.id, input)).status,
      'invalid_input',
    )
  }
  assert.equal(
    (await repo.updateNote(alice, 'malformed', {title: 'Bad'})).status,
    'invalid_input',
  )
  assert.equal(await repo.getNote(alice, 'malformed'), null)
  assert.equal((await repo.getNote(alice, note.id))?.title, note.title)
  assert.equal(
    success(await repo.updateNote(alice, note.id, {title: 'Valid'})).title,
    'Valid',
  )
})

test('missing or empty mutation IDs never broaden a write to every owned note', async () => {
  const note = await fixture()
  for (const id of [undefined, null, '', 123] as unknown as string[]) {
    assert.equal(
      (await repo.updateNote(alice, id, {title: 'Attack'})).status,
      'invalid_input',
    )
    assert.equal(
      (await repo.moveNoteToTrash(alice, id)).status,
      'invalid_input',
    )
    assert.equal(
      (await repo.restoreNote(alice, id, '2026-10-23T00:00:00.000000Z')).status,
      'invalid_input',
    )
  }
  assert.equal((await repo.getNote(alice, note.id))?.title, note.title)
})

test('foreign-owned and absent rows have the same read/mutation outcomes in every lifecycle state', async () => {
  const note = await fixture()
  const absent = randomUUID()
  for (const id of [note.id, absent]) {
    assert.equal(await repo.getNote(bob, id), null)
    assert.equal(
      (await repo.updateNote(bob, id, {title: 'Attack'})).status,
      'unavailable',
    )
    assert.equal((await repo.moveNoteToTrash(bob, id)).status, 'unavailable')
  }
  const trashed = success(await repo.moveNoteToTrash(alice, note.id))
  for (const id of [note.id, absent]) {
    assert.equal(await repo.getTrashNote(bob, id), null)
    assert.equal(
      (await repo.restoreNote(bob, id, trashed.deadlineToken)).status,
      'unavailable',
    )
    assert.equal(
      (await repo.permanentlyDeleteTrashedNote(bob, id, trashed.deadlineToken))
        .status,
      'unavailable',
    )
  }
  assert.equal((await repo.getListNote(bob)).length, 0)
  assert.equal((await repo.getTrashNotes(bob)).length, 0)
  assert.ok(await repo.getTrashNote(alice, note.id))
})

test('atomic draft trash preserves metadata and elapsed retention across DST; repeat never extends or overwrites', async () => {
  const note = await fixture()
  await db
    .update(notesTable)
    .set({isArchived: true, isEncrypted: true})
    .where(eq(notesTable.id, note.id))
  await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL TIME ZONE 'America/New_York'`)
    const r = createNoteRepository(tx)
    const [before] = await tx
      .select({time: sql<Date>`clock_timestamp()`})
      .from(notesTable)
      .where(eq(notesTable.id, note.id))
    const trashed = success(
      await r.moveNoteToTrash(alice, note.id, {
        title: 'Draft',
        content: 'Unsaved body',
        theme: 'pink',
      }),
    )
    const [after] = await tx
      .select({time: sql<Date>`clock_timestamp()`})
      .from(notesTable)
      .where(eq(notesTable.id, note.id))
    const time = trashed.pendingDeleteAt!.getTime()
    assert.ok(
      time >= new Date(before.time).getTime() + NOTE_RETENTION_SECONDS * 1000,
    )
    assert.ok(
      time <= new Date(after.time).getTime() + NOTE_RETENTION_SECONDS * 1000,
    )
    assert.match(trashed.deadlineToken!, /\.\d{6}Z$/)
    const repeat = await r.moveNoteToTrash(alice, note.id, {
      title: 'Overwrite',
      content: null,
      theme: null,
    })
    assert.equal(repeat.status, 'already_applied')
    assert.equal(success(repeat).deadlineToken, trashed.deadlineToken)
    assert.equal(success(repeat).content, 'Unsaved body')
    assert.equal(await r.getNote(alice, note.id), null)
    assert.ok(!(await r.getListNote(alice)).some((row) => row.id === note.id))
    assert.equal(
      (await r.updateNote(alice, note.id, {title: 'Stale save'})).status,
      'unavailable',
    )
    const restored = success(
      await r.restoreNote(alice, note.id, trashed.deadlineToken),
    )
    assert.equal(restored.pendingDeleteAt, null)
    assert.equal(restored.id, note.id)
    assert.equal(restored.authorId, alice)
    assert.equal(restored.createdAt.getTime(), note.createdAt.getTime())
    assert.equal(restored.isArchived, true)
    assert.equal(restored.isEncrypted, true)
    assert.equal(restored.title, 'Draft')
    assert.equal(restored.content, 'Unsaved body')
    assert.equal(restored.theme, 'pink')
    assert.ok(restored.updatedAt.getTime() >= note.updatedAt.getTime())
    const retrash = success(await r.moveNoteToTrash(alice, note.id))
    assert.notEqual(retrash.deadlineToken, trashed.deadlineToken)
    assert.equal(
      (await r.restoreNote(alice, note.id, trashed.deadlineToken)).status,
      'conflict',
    )
    assert.equal(
      (
        await r.permanentlyDeleteTrashedNote(
          alice,
          note.id,
          trashed.deadlineToken,
        )
      ).status,
      'conflict',
    )
    assert.equal(
      (
        await r.permanentlyDeleteTrashedNote(
          alice,
          note.id,
          retrash.deadlineToken,
        )
      ).status,
      'success',
    )
    assert.equal(
      (await r.restoreNote(alice, note.id, retrash.deadlineToken)).status,
      'unavailable',
    )
    assert.equal(
      (
        await r.permanentlyDeleteTrashedNote(
          alice,
          note.id,
          retrash.deadlineToken,
        )
      ).status,
      'unavailable',
    )
  })
})

test('invalid drafts cannot partially save; active notes cannot use trash-only mutations', async () => {
  const note = await fixture()
  assert.equal(
    (
      await repo.moveNoteToTrash(alice, note.id, {
        title: 'Partial',
        content: 'Body',
        theme: 'invalid',
      })
    ).status,
    'invalid_input',
  )
  assert.equal(
    (await repo.moveNoteToTrash(alice, note.id, {title: 'Incomplete'})).status,
    'invalid_input',
  )
  const loaded = await repo.getNote(alice, note.id)
  assert.equal(loaded?.title, note.title)
  assert.equal(loaded?.pendingDeleteAt, null)
  const token = new Date(Date.now() + 100000).toISOString().replace('Z', '000Z')
  assert.equal(
    (await repo.restoreNote(alice, note.id, token)).status,
    'unavailable',
  )
  assert.equal(
    (await repo.permanentlyDeleteTrashedNote(alice, note.id, token)).status,
    'unavailable',
  )
  assert.equal(
    (await repo.restoreNote(alice, note.id, 'invalid')).status,
    'invalid_input',
  )
})

test('database clock boundaries: before, exactly at, and after expiry; delayed cleanup retains unreadable rows', async () => {
  for (const offset of [1, 0, -1]) {
    const note = await fixture()
    await db.transaction(async (tx) => {
      const r = createNoteRepository(tx)
      const [row] = await tx
        .update(notesTable)
        .set({pendingDeleteAt: sql`now() + ${offset} * interval '1 second'`})
        .where(eq(notesTable.id, note.id))
        .returning({
          token: sql<string>`to_char(${notesTable.pendingDeleteAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        })
      assert.equal(await r.getNote(alice, note.id), null)
      assert.equal(!!(await r.getTrashNote(alice, note.id)), offset > 0)
      assert.equal(
        (await r.getTrashNotes(alice)).some((item) => item.id === note.id),
        offset > 0,
      )
      if (offset <= 0) {
        assert.equal(
          (await r.restoreNote(alice, note.id, row.token)).status,
          'unavailable',
        )
        assert.equal(
          (await r.permanentlyDeleteTrashedNote(alice, note.id, row.token))
            .status,
          'unavailable',
        )
        assert.equal(
          (await r.moveNoteToTrash(alice, note.id)).status,
          'unavailable',
        )
        assert.equal(
          (await tx.select().from(notesTable).where(eq(notesTable.id, note.id)))
            .length,
          1,
        )
      } else
        assert.equal(
          (await r.restoreNote(alice, note.id, row.token)).status,
          'success',
        )
    })
  }
})

// Hold the first write's transaction open, then prove the second connection is
// blocked on a database lock before allowing the first to commit.
async function race(
  first: (
    r: ReturnType<typeof createNoteRepository>,
  ) => Promise<NoteMutationResult>,
  second: () => Promise<NoteMutationResult>,
) {
  let ready!: () => void
  let release!: () => void
  const started = new Promise<void>((resolve) => {
    ready = resolve
  })
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const winner = db.transaction(async (tx) => {
    const result = await first(createNoteRepository(tx))
    ready()
    await gate
    return result
  })
  // Propagate early errors instead of hanging forever waiting for ready().
  await Promise.race([started, winner])
  const contender = second()
  try {
    let blocked = false
    for (let i = 0; i < 100; i++) {
      const [state] =
        await client`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()) AS blocked`
      if (state.blocked) {
        blocked = true
        break
      }
      await delay(10)
    }
    assert.ok(blocked, 'Second connection must reach the row lock')
  } finally {
    release()
  }
  return Promise.all([winner, contender])
}

test('concurrent save then trash commits both; trash then stale save rejects the save', async () => {
  const first = await fixture()
  const a = await race(
    (r) => r.updateNote(alice, first.id, {content: 'Concurrent saved'}),
    () => repo.moveNoteToTrash(alice, first.id),
  )
  assert.deepEqual(
    a.map((row) => row.status),
    ['success', 'success'],
  )
  assert.equal(
    (await repo.getTrashNote(alice, first.id))?.content,
    'Concurrent saved',
  )
  const second = await fixture()
  const b = await race(
    (r) => r.moveNoteToTrash(alice, second.id),
    () => repo.updateNote(alice, second.id, {content: 'Stale'}),
  )
  assert.deepEqual(
    b.map((row) => row.status),
    ['success', 'unavailable'],
  )
  assert.equal(
    (await repo.getTrashNote(alice, second.id))?.content,
    second.content,
  )
})

test('concurrent trash requests preserve the first committed draft and deadline', async () => {
  const note = await fixture()
  const outcomes = await race(
    (r) =>
      r.moveNoteToTrash(alice, note.id, {
        title: 'First draft',
        content: 'Keep',
        theme: 'blue',
      }),
    () =>
      repo.moveNoteToTrash(alice, note.id, {
        title: 'Late draft',
        content: 'Discard',
        theme: 'red',
      }),
  )
  assert.deepEqual(
    outcomes.map((row) => row.status),
    ['success', 'already_applied'],
  )
  assert.equal(
    success(outcomes[0]).deadlineToken,
    success(outcomes[1]).deadlineToken,
  )
  assert.equal((await repo.getTrashNote(alice, note.id))?.content, 'Keep')
})

test('concurrent restore/permanent-delete has one winner in both lock orders', async () => {
  for (const restoreFirst of [true, false]) {
    const note = await fixture()
    const token = success(
      await repo.moveNoteToTrash(alice, note.id),
    ).deadlineToken
    const a = await race(
      (r) =>
        restoreFirst
          ? r.restoreNote(alice, note.id, token)
          : r.permanentlyDeleteTrashedNote(alice, note.id, token),
      () =>
        restoreFirst
          ? repo.permanentlyDeleteTrashedNote(alice, note.id, token)
          : repo.restoreNote(alice, note.id, token),
    )
    assert.deepEqual(
      a.map((row) => row.status),
      ['success', 'unavailable'],
    )
    assert.equal(!!(await repo.getNote(alice, note.id)), restoreFirst)
    assert.equal(await repo.getTrashNote(alice, note.id), null)
  }
})

test('migration installs distinct owner-order and due-expiry indexes; cache tags include identity', async () => {
  const indexes =
    await client`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'notes'`
  for (const name of [
    'notes_owner_trash_deadline_idx',
    'notes_expiry_deadline_idx',
  ]) {
    const index = indexes.find((row) => row.indexname === name)
    assert.ok(index)
    assert.match(index.indexdef, /WHERE \(pending_deleted_at IS NOT NULL\)/)
  }
  assert.notDeepEqual(
    getNoteMutationCacheKeys(alice, 'same-note'),
    getNoteMutationCacheKeys(bob, 'same-note'),
  )
  assert.equal(getNoteMutationCacheKeys(alice, 'same-note').length, 3)
})

async function drainExpiredFixtures() {
  while ((await cleanup.deleteExpiredBatch(100)).length === 100) {
    // Only this explicitly disposable test database may be swept by these tests.
  }
}

test('cleanup uses database deadlines across owners; active/restored/future notes survive', async () => {
  await drainExpiredFixtures()
  const restored = success(
    await repo.moveNoteToTrash(alice, (await fixture()).id),
  )
  success(await repo.restoreNote(alice, restored.id, restored.deadlineToken))
  const rows = await db
    .insert(notesTable)
    .values([
      {authorId: alice, title: 'Active'},
      {
        authorId: bob,
        pendingDeleteAt: sql`statement_timestamp() + interval '1 hour'`,
      },
      {authorId: alice, pendingDeleteAt: sql`statement_timestamp()`},
      {
        authorId: bob,
        pendingDeleteAt: sql`statement_timestamp() - interval '1 second'`,
      },
      {
        authorId: alice,
        isArchived: true,
        pendingDeleteAt: sql`statement_timestamp() - interval '45 days'`,
      },
    ])
    .returning()
  const removed = await cleanup.deleteExpiredBatch(100, (identities) => {
    assert.ok(
      identities.every(
        (row) => Object.keys(row).sort().join() === 'authorId,id',
      ),
    )
  })
  assert.deepEqual(
    new Set(removed.map((row) => row.id)),
    new Set(rows.slice(2).map((row) => row.id)),
  )
  assert.deepEqual(
    new Set(removed.map((row) => row.authorId)),
    new Set([alice, bob]),
  )
  assert.ok(await repo.getNote(alice, rows[0].id))
  assert.ok(await repo.getTrashNote(bob, rows[1].id))
  assert.ok(await repo.getNote(alice, restored.id))
  assert.equal((await cleanup.deleteExpiredBatch(100)).length, 0)
})

test('cleanup enforces batch limits and overlapping workers delete each expired row once', async () => {
  await drainExpiredFixtures()
  for (const limit of [0, -1, 101, 1.5, NaN, Infinity])
    await assert.rejects(cleanup.deleteExpiredBatch(limit), RangeError)
  const rows = await db
    .insert(notesTable)
    .values(
      Array.from({length: 205}, (_, i) => ({
        authorId: i % 2 ? alice : bob,
        pendingDeleteAt: sql`statement_timestamp() - interval '1 day'`,
      })),
    )
    .returning({id: notesTable.id})
  const workers = await Promise.all([
    cleanup.deleteExpiredBatch(100),
    cleanup.deleteExpiredBatch(100),
  ])
  assert.ok(workers.every((batch) => batch.length === 100))
  const remaining = await cleanup.deleteExpiredBatch(100)
  assert.equal(remaining.length, 5)
  const removed = [...workers.flat(), ...remaining].map((row) => row.id)
  assert.equal(new Set(removed).size, 205)
  assert.deepEqual(new Set(removed), new Set(rows.map((row) => row.id)))
  assert.equal((await cleanup.deleteExpiredBatch(100)).length, 0)
})

test('cleanup skips locked rows and rechecks current eligibility after a concurrent change', async () => {
  await drainExpiredFixtures()
  const note = await fixture()
  await db
    .update(notesTable)
    .set({pendingDeleteAt: sql`statement_timestamp() - interval '1 day'`})
    .where(eq(notesTable.id, note.id))
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT id FROM ${notesTable} WHERE id = ${note.id} FOR UPDATE`,
    )
    assert.equal((await cleanup.deleteExpiredBatch(100)).length, 0)
    await tx
      .update(notesTable)
      .set({pendingDeleteAt: null})
      .where(eq(notesTable.id, note.id))
  })
  assert.equal((await cleanup.deleteExpiredBatch(100)).length, 0)
  assert.ok(await repo.getNote(alice, note.id))
})

test('failed invalidation rolls back the batch; retry safely deletes it', async () => {
  await drainExpiredFixtures()
  const note = await fixture()
  await db
    .update(notesTable)
    .set({pendingDeleteAt: sql`statement_timestamp() - interval '1 day'`})
    .where(eq(notesTable.id, note.id))
  await assert.rejects(
    cleanup.deleteExpiredBatch(100, () => {
      throw new Error('Invalidation unavailable')
    }),
  )
  assert.equal(
    (await db.select().from(notesTable).where(eq(notesTable.id, note.id)))
      .length,
    1,
  )
  assert.deepEqual(
    (await cleanup.deleteExpiredBatch(100)).map((row) => row.id),
    [note.id],
  )
  assert.equal((await cleanup.deleteExpiredBatch(100)).length, 0)
})
