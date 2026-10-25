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
