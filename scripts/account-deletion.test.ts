import assert from 'node:assert/strict'
import {after, before, test} from 'node:test'
import {randomUUID} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import postgres from 'postgres'
import {drizzle} from 'drizzle-orm/postgres-js'
import {migrate} from 'drizzle-orm/postgres-js/migrator'
import {eq, inArray, sql} from 'drizzle-orm'
import {createAccountRepository} from '../db/repositories/account'
import {createNoteRepository} from '../db/repositories/notes'
import {usersTable} from '../db/schema/users'
import {notesTable} from '../db/schema/notes'
import {featureAccessTable} from '../db/schema/feature-access'
import {userAppearanceTable} from '../db/schema/user-appearance'
import {matchesSessionUser} from '../lib/auth/session-identity'

const url = process.env.NOTES_TEST_DATABASE_URL
assert.ok(url, 'Run test:account to provision an isolated local test database')
const parsed = new URL(url)
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) &&
    /_test(?:_|$)/.test(parsed.pathname),
)
if (process.env.DATABASE_URL)
  assert.notEqual(new URL(process.env.DATABASE_URL).pathname, parsed.pathname)
const client = postgres(url, {max: 5, onnotice: () => {}})
const db = drizzle({client})
const account = createAccountRepository(db)
const notes = createNoteRepository(db)
const owners: string[] = []

before(async () => {
  await migrate(db, {migrationsFolder: './drizzle'})
})
after(async () => {
  try {
    if (owners.length) {
      await db.delete(notesTable).where(inArray(notesTable.authorId, owners))
      await db
        .delete(featureAccessTable)
        .where(inArray(featureAccessTable.userId, owners))
      await db
        .delete(userAppearanceTable)
        .where(inArray(userAppearanceTable.userId, owners))
      await db.delete(usersTable).where(inArray(usersTable.id, owners))
    }
  } finally {
    await client.end()
  }
})

async function owner(email = `account-${randomUUID()}@test.invalid`) {
  const [user] = await db
    .insert(usersTable)
    .values({name: 'Account fixture', email})
    .returning()
  owners.push(user.id)
  return user
}
async function dependencies(id: string) {
  await db
    .insert(featureAccessTable)
    .values({userId: id, feature: 'test-feature'})
  await db
    .insert(userAppearanceTable)
    .values({userId: id, appearance: 'sepia', mode: 'dark'})
}

test('bulk trash includes archived notes, preserves existing/expired deadlines and isolates owners', async () => {
  const alice = await owner()
  const bob = await owner()
  const deadline = new Date(Date.now() + 100000)
  const expired = new Date(Date.now() - 100000)
  const rows = await db
    .insert(notesTable)
    .values([
      {authorId: alice.id, title: 'Active'},
      {authorId: alice.id, title: 'Archived', isArchived: true},
      {authorId: alice.id, title: 'Existing trash', pendingDeleteAt: deadline},
      {authorId: alice.id, title: 'Expired trash', pendingDeleteAt: expired},
      {authorId: bob.id, title: 'Other owner'},
    ])
    .returning()
  assert.equal(await account.activeNoteCount(alice.id), 2)
  const before = Date.now()
  assert.deepEqual(await account.moveAllNotesToTrash(alice.id), {count: 2})
  const moved = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.authorId, alice.id))
  const active = moved.filter((row) =>
    ['Active', 'Archived'].includes(row.title!),
  )
  assert.equal(
    active[0].pendingDeleteAt!.getTime(),
    active[1].pendingDeleteAt!.getTime(),
  )
  assert.ok(active[0].pendingDeleteAt!.getTime() >= before + 30 * 86400000)
  assert.ok(active[0].pendingDeleteAt!.getTime() <= Date.now() + 30 * 86400000)
  assert.equal(
    moved
      .find((row) => row.title === 'Existing trash')!
      .pendingDeleteAt!.getTime(),
    deadline.getTime(),
  )
  assert.equal(
    moved
      .find((row) => row.title === 'Expired trash')!
      .pendingDeleteAt!.getTime(),
    expired.getTime(),
  )
  assert.equal((await notes.getListNote(bob.id)).length, 1)
  const deadlineToken = (await notes.getTrashNote(alice.id, rows[0].id))!
    .deadlineToken
  assert.deepEqual(await account.moveAllNotesToTrash(alice.id), {count: 0})
  assert.equal(
    (await notes.getTrashNote(alice.id, rows[0].id))!.deadlineToken,
    deadlineToken,
  )
  assert.equal(
    (await account.mutateNote(alice.id, (repo) =>
      repo.updateNote(alice.id, rows[0].id, {title: 'Stale save'}),
    ))!.status,
    'unavailable',
  )
  assert.equal(
    (await notes.restoreNote(alice.id, rows[0].id, deadlineToken)).status,
    'success',
  )
})

test('account deletion removes dependencies atomically; same-email signup has a fresh identity', async () => {
  const alice = await owner()
  const bob = await owner()
  await dependencies(alice.id)
  await dependencies(bob.id)
  await db.insert(notesTable).values([
    {authorId: alice.id, title: 'Active'},
    {authorId: alice.id, title: 'Archived', isArchived: true},
    {authorId: alice.id, title: 'Trash', pendingDeleteAt: new Date()},
    {authorId: bob.id, title: 'Other owner'},
  ])
  assert.deepEqual(await account.deleteAccount(alice.id), {deleted: true})
  assert.equal(
    (
      await db
        .select()
        .from(notesTable)
        .where(eq(notesTable.authorId, alice.id))
    ).length,
    0,
  )
  assert.equal(
    (
      await db
        .select()
        .from(featureAccessTable)
        .where(eq(featureAccessTable.userId, alice.id))
    ).length,
    0,
  )
  assert.equal(
    (
      await db
        .select()
        .from(userAppearanceTable)
        .where(eq(userAppearanceTable.userId, alice.id))
    ).length,
    0,
  )
  assert.equal(
    (await db.select().from(usersTable).where(eq(usersTable.id, alice.id)))
      .length,
    0,
  )
  assert.equal((await notes.getListNote(bob.id)).length, 1)
  assert.equal(
    (
      await db
        .select()
        .from(featureAccessTable)
        .where(eq(featureAccessTable.userId, bob.id))
    ).length,
    1,
  )
  assert.equal(
    (
      await db
        .select()
        .from(userAppearanceTable)
        .where(eq(userAppearanceTable.userId, bob.id))
    ).length,
    1,
  )
  assert.equal(await account.deleteAccount(alice.id), null)
  const recreated = await owner(alice.email)
  assert.notEqual(recreated.id, alice.id)
  assert.equal(matchesSessionUser(alice.id, recreated), false)
  assert.equal((await notes.getListNote(recreated.id)).length, 0)
  assert.equal(
    await account.mutateNote(alice.id, (repo) =>
      repo.createNote(alice.id, {title: 'Stale create'}),
    ),
    null,
  )
})

test('a failed dependency delete rolls back notes, preferences, grants, and user deletion', async () => {
  const alice = await owner()
  await dependencies(alice.id)
  await notes.createNote(alice.id, {title: 'Must survive rollback'})
  await db.execute(
    sql`CREATE TABLE account_delete_blocker (user_id uuid REFERENCES users(id))`,
  )
  try {
    await db.execute(
      sql`INSERT INTO account_delete_blocker VALUES (${alice.id})`,
    )
    await assert.rejects(() => account.deleteAccount(alice.id))
    assert.equal((await notes.getListNote(alice.id)).length, 1)
    assert.equal(
      (
        await db
          .select()
          .from(featureAccessTable)
          .where(eq(featureAccessTable.userId, alice.id))
      ).length,
      1,
    )
    assert.equal(
      (
        await db
          .select()
          .from(userAppearanceTable)
          .where(eq(userAppearanceTable.userId, alice.id))
      ).length,
      1,
    )
    assert.equal(
      (await db.select().from(usersTable).where(eq(usersTable.id, alice.id)))
        .length,
      1,
    )
  } finally {
    await db.execute(sql`DROP TABLE account_delete_blocker`)
  }
})

test('an in-flight note create finishes before bulk trash; subsequent stale saves cannot revive it', async () => {
  const alice = await owner()
  let release!: () => void
  let acquired!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const locked = new Promise<void>((resolve) => {
    acquired = resolve
  })
  const creation = account.mutateNote(alice.id, async (repo) => {
    acquired()
    await gate
    return repo.createNote(alice.id, {title: 'Concurrent create'})
  })
  await locked
  let completed = false
  const bulk = account.moveAllNotesToTrash(alice.id).then((result) => {
    completed = true
    return result
  })
  try {
    await delay(30)
    assert.equal(completed, false)
  } finally {
    release()
  }
  const created = await creation
  assert.equal(created?.status, 'success')
  assert.deepEqual(await bulk, {count: 1})
  assert.equal((await notes.getListNote(alice.id)).length, 0)
})

test('account deletion serializes behind note writes and refuses later writes for the deleted ID', async () => {
  const alice = await owner()
  let release!: () => void
  let acquired!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const locked = new Promise<void>((resolve) => {
    acquired = resolve
  })
  const creation = account.mutateNote(alice.id, async (repo) => {
    acquired()
    await gate
    return repo.createNote(alice.id, {title: 'In-flight'})
  })
  await locked
  const deletion = account.deleteAccount(alice.id)
  release()
  await creation
  assert.deepEqual(await deletion, {deleted: true})
  assert.equal(
    await account.mutateNote(alice.id, (repo) =>
      repo.createNote(alice.id, {title: 'Late'}),
    ),
    null,
  )
  assert.equal(
    (
      await db
        .select()
        .from(notesTable)
        .where(eq(notesTable.authorId, alice.id))
    ).length,
    0,
  )
})

test('Restore all restores only this owner’s recoverable notes and preserves note metadata', async () => {
  const alice = await owner()
  const bob = await owner()
  const future = new Date(Date.now() + 100000)
  const [active, archived, encrypted, expired, other] = await db
    .insert(notesTable)
    .values([
      {
        authorId: alice.id,
        title: 'Bulk restore active',
        content: 'Keep body',
        theme: 'pink',
        pendingDeleteAt: future,
      },
      {
        authorId: alice.id,
        title: 'Bulk restore archived',
        isArchived: true,
        pendingDeleteAt: future,
      },
      {
        authorId: alice.id,
        title: 'Bulk restore encrypted',
        isEncrypted: true,
        theme: 'encrypted',
        pendingDeleteAt: future,
      },
      {
        authorId: alice.id,
        title: 'Expired',
        pendingDeleteAt: new Date(Date.now() - 10000),
      },
      {authorId: bob.id, title: 'Other owner trash', pendingDeleteAt: future},
    ])
    .returning()
  const preview = await account.previewTrash(alice.id)
  assert.equal(preview.count, 3)
  assert.equal((await notes.getTrashSummary(alice.id)).count, 3)
  const result = await account.restoreAllTrash(alice.id, preview.snapshot)
  assert.equal(result?.status, 'success')
  assert.ok(result && 'count' in result)
  assert.equal(result.count, 3)
  const restored = await notes.getListNote(alice.id)
  assert.equal(restored.length, 3)
  for (const original of [active, archived, encrypted]) {
    const current = restored.find((row) => row.id === original.id)!
    for (const field of [
      'title',
      'content',
      'theme',
      'isArchived',
      'isEncrypted',
      'authorId',
    ] as const)
      assert.equal(current[field], original[field])
    assert.equal(current.createdAt.getTime(), original.createdAt.getTime())
    assert.equal(current.pendingDeleteAt, null)
  }
  assert.equal((await notes.getTrashSummary(alice.id)).count, 0)
  assert.equal(await notes.getNote(alice.id, expired.id), null)
  assert.equal((await notes.getTrashNotes(bob.id))[0].id, other.id)
})

test('Empty Trash permanently deletes confirmed recoverable rows, preserving active notes, other owners and account preferences', async () => {
  const alice = await owner()
  const bob = await owner()
  await dependencies(alice.id)
  const future = new Date(Date.now() + 100000)
  const rows = await db
    .insert(notesTable)
    .values([
      {authorId: alice.id, title: 'Keep active'},
      {authorId: alice.id, title: 'Delete trash', pendingDeleteAt: future},
      {
        authorId: alice.id,
        title: 'Delete archived trash',
        isArchived: true,
        pendingDeleteAt: future,
      },
      {
        authorId: alice.id,
        title: 'Expired pending cleanup',
        pendingDeleteAt: new Date(Date.now() - 10000),
      },
      {
        authorId: bob.id,
        title: 'Keep other owner trash',
        pendingDeleteAt: future,
      },
    ])
    .returning()
  const preview = await account.previewTrash(alice.id)
  assert.equal(preview.count, 2)
  const result = await account.emptyTrash(alice.id, preview.snapshot)
  assert.equal(result?.status, 'success')
  assert.ok(result && 'count' in result)
  assert.equal(result.count, 2)
  assert.equal((await notes.getListNote(alice.id))[0].id, rows[0].id)
  const remaining = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.authorId, alice.id))
  assert.deepEqual(
    new Set(remaining.map((row) => row.id)),
    new Set([rows[0].id, rows[3].id]),
  )
  assert.equal((await notes.getTrashNotes(bob.id))[0].id, rows[4].id)
  assert.equal(
    (await db.select().from(usersTable).where(eq(usersTable.id, alice.id)))
      .length,
    1,
  )
  assert.equal(
    (
      await db
        .select()
        .from(featureAccessTable)
        .where(eq(featureAccessTable.userId, alice.id))
    ).length,
    1,
  )
  assert.equal(
    (
      await db
        .select()
        .from(userAppearanceTable)
        .where(eq(userAppearanceTable.userId, alice.id))
    ).length,
    1,
  )
  assert.equal(
    (await account.emptyTrash(alice.id, preview.snapshot))?.status,
    'conflict',
  )
})

test('bulk confirmation rejects added notes, changed trash cycles, expired notes, malformed snapshots and another owner’s snapshot', async () => {
  const alice = await owner()
  const bob = await owner()
  const [note] = await db
    .insert(notesTable)
    .values({
      authorId: alice.id,
      title: 'Cycle',
      pendingDeleteAt: new Date(Date.now() + 100000),
    })
    .returning()
  const initial = await account.previewTrash(alice.id)
  assert.equal(
    (await account.emptyTrash(bob.id, initial.snapshot))?.status,
    'conflict',
  )
  for (const snapshot of [
    undefined,
    null,
    '',
    'invalid',
    {snapshot: initial.snapshot},
  ])
    assert.equal(
      (await account.emptyTrash(alice.id, snapshot))?.status,
      'invalid_input',
    )
  const cycle = (await notes.getTrashNote(alice.id, note.id))!
  assert.equal(
    (await notes.restoreNote(alice.id, note.id, cycle.deadlineToken)).status,
    'success',
  )
  await delay(2)
  assert.equal(
    (await notes.moveNoteToTrash(alice.id, note.id)).status,
    'success',
  )
  assert.equal(
    (await account.emptyTrash(alice.id, initial.snapshot))?.status,
    'conflict',
  )
  const next = await account.previewTrash(alice.id)
  const [added] = await db
    .insert(notesTable)
    .values({
      authorId: alice.id,
      title: 'Added later',
      pendingDeleteAt: new Date(Date.now() + 100000),
    })
    .returning()
  assert.equal(
    (await account.restoreAllTrash(alice.id, next.snapshot))?.status,
    'conflict',
  )
  assert.equal((await notes.getTrashNotes(alice.id)).length, 2)
  const beforeExpiry = await account.previewTrash(alice.id)
  await db
    .update(notesTable)
    .set({pendingDeleteAt: sql`clock_timestamp() - interval '1 second'`})
    .where(eq(notesTable.id, added.id))
  assert.equal(
    (await account.emptyTrash(alice.id, beforeExpiry.snapshot))?.status,
    'conflict',
  )
  assert.equal((await notes.getTrashSummary(alice.id)).count, 1)
  assert.equal(
    (
      await db
        .select()
        .from(notesTable)
        .where(eq(notesTable.authorId, alice.id))
    ).length,
    2,
  )
})

test('simultaneous Restore all and Empty Trash have one winner and cannot reuse an old confirmation', async () => {
  const alice = await owner()
  await db.insert(notesTable).values({
    authorId: alice.id,
    title: 'Race',
    pendingDeleteAt: new Date(Date.now() + 100000),
  })
  const preview = await account.previewTrash(alice.id)
  const results = await Promise.all([
    account.restoreAllTrash(alice.id, preview.snapshot),
    account.emptyTrash(alice.id, preview.snapshot),
  ])
  assert.equal(
    results.filter((result) => result?.status === 'success').length,
    1,
  )
  assert.equal(
    results.filter((result) => result?.status === 'conflict').length,
    1,
  )
  assert.equal((await notes.getTrashSummary(alice.id)).count, 0)
  const empty = await account.previewTrash(alice.id)
  const noOp = await account.emptyTrash(alice.id, empty.snapshot)
  assert.equal(noOp?.status, 'success')
  assert.ok(noOp && 'count' in noOp)
  assert.equal(noOp.count, 0)
})

test('failed Empty Trash rolls back the whole confirmed batch', async () => {
  const alice = await owner()
  const rows = await db
    .insert(notesTable)
    .values([
      {
        authorId: alice.id,
        title: 'First',
        pendingDeleteAt: new Date(Date.now() + 100000),
      },
      {
        authorId: alice.id,
        title: 'Blocked',
        pendingDeleteAt: new Date(Date.now() + 100000),
      },
    ])
    .returning()
  const preview = await account.previewTrash(alice.id)
  await db.execute(
    sql`CREATE TABLE trash_bulk_blocker (note_id uuid REFERENCES notes(id))`,
  )
  try {
    await db.execute(sql`INSERT INTO trash_bulk_blocker VALUES (${rows[1].id})`)
    await assert.rejects(() => account.emptyTrash(alice.id, preview.snapshot))
    assert.equal((await notes.getTrashSummary(alice.id)).count, 2)
    assert.deepEqual(await account.previewTrash(alice.id), preview)
  } finally {
    await db.execute(sql`DROP TABLE trash_bulk_blocker`)
  }
})
