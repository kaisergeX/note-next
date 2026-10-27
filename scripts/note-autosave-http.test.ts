import assert from 'node:assert/strict'
import {test} from 'node:test'
import {randomUUID} from 'node:crypto'
import postgres from 'postgres'
import {drizzle} from 'drizzle-orm/postgres-js'
import {eq, inArray} from 'drizzle-orm'
import {encode} from 'next-auth/jwt'
import {usersTable} from '../db/schema/users'
import {notesTable} from '../db/schema/notes'
import type {SyncRequest, SyncResult} from '../lib/notes/sync'

const origin = process.env.NOTES_TEST_ORIGIN
assert.ok(origin && process.env.DATABASE_URL)
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(
    new URL(process.env.DATABASE_URL).hostname,
  ),
)
const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
assert.ok(secret)
const client = postgres(process.env.DATABASE_URL, {max: 2, onnotice: () => {}})
const db = drizzle({client})

test('sync HTTP boundary: auth, same origin, account isolation, strict payloads, retries, conflicts and remote Trash', async () => {
  const owners: string[] = []
  const request: SyncRequest = {
    ownerId: randomUUID(),
    noteId: null,
    creationId: randomUUID(),
    mutationId: randomUUID(),
    expectedRevision: null,
    content: {
      title: 'Temporary sync HTTP fixture',
      content: '<p>Body</p>',
      theme: null,
    },
    kind: 'save',
  }
  const post = (
    body: unknown,
    cookie = '',
    requestOrigin: string | undefined = origin,
  ) =>
    fetch(`${origin}/api/note/sync`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        ...(requestOrigin ? {Origin: requestOrigin} : {}),
        ...(cookie ? {Cookie: cookie} : {}),
      },
      body: JSON.stringify(body),
    })
  const result = async (body: unknown, cookie: string) => {
    const response = await post(body, cookie)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('cache-control') ?? '', /no-store/)
    return (await response.json()) as SyncResult
  }
  const user = async () => {
    const email = `sync-http-${randomUUID()}@test.invalid`
    const [row] = await db
      .insert(usersTable)
      .values({email, name: 'Temporary sync HTTP fixture'})
      .returning()
    owners.push(row.id)
    const token = await encode({
      secret,
      salt: 'authjs.session-token',
      token: {
        sub: 'sync-http-fixture',
        userId: row.id,
        email,
        role: 'note-taker',
      },
    })
    return {id: row.id, cookie: `authjs.session-token=${token}`}
  }
  const acknowledged = (value: SyncResult) => {
    assert.equal(value.status, 'success')
    if (value.status !== 'success') throw new Error('Missing acknowledgement')
    return value.note
  }
  try {
    assert.equal((await post(request)).status, 401)
    const alice = await user(),
      bob = await user()
    request.ownerId = alice.id
    assert.equal(
      (await post(request, alice.cookie, 'https://other.invalid')).status,
      403,
    )
    assert.equal((await post(request, alice.cookie, '')).status, 403)
    assert.equal(
      (await result({...request, ownerId: bob.id}, alice.cookie)).status,
      'account_changed',
    )
    assert.equal(
      (
        await result(
          {...request, content: {...request.content, authorId: alice.id}},
          alice.cookie,
        )
      ).status,
      'invalid_input',
    )
    assert.equal(
      (
        await result(
          {
            ...request,
            content: {...request.content, content: 'x'.repeat(262145)},
          },
          alice.cookie,
        )
      ).status,
      'invalid_input',
    )
    const first = acknowledged(await result(request, alice.cookie))
    const replay = acknowledged(await result(request, alice.cookie))
    assert.equal(replay.id, first.id)
    assert.equal(replay.revision, first.revision)
    const update = {
      ...request,
      noteId: first.id,
      expectedRevision: first.revision,
      mutationId: randomUUID(),
      content: {...request.content, content: '<p>Mine</p>'},
    }
    const saved = acknowledged(await result(update, alice.cookie))
    assert.equal(
      acknowledged(await result(update, alice.cookie)).revision,
      saved.revision,
    )
    const conflict = await result(
      {
        ...update,
        mutationId: randomUUID(),
        content: {...update.content, content: '<p>Stale</p>'},
      },
      alice.cookie,
    )
    assert.equal(conflict.status, 'conflict')
    if (conflict.status === 'conflict')
      assert.equal(conflict.note.content, '<p>Mine</p>')
    const foreign = await result({...update, ownerId: bob.id}, bob.cookie)
    assert.deepEqual(foreign, {status: 'unavailable'})
    const trash = {
      ...update,
      expectedRevision: saved.revision,
      mutationId: randomUUID(),
      kind: 'trash' as const,
    }
    const trashed = acknowledged(await result(trash, alice.cookie))
    assert.ok(trashed.pendingDeleteAt)
    assert.equal(
      acknowledged(await result(trash, alice.cookie)).revision,
      trashed.revision,
    )
    assert.deepEqual(
      await result(
        {...update, expectedRevision: saved.revision, mutationId: randomUUID()},
        alice.cookie,
      ),
      {status: 'unavailable'},
    )
    await db.delete(notesTable).where(eq(notesTable.id, first.id))
    assert.deepEqual(await result(request, alice.cookie), {
      status: 'unavailable',
    })
    const malformed = await fetch(`${origin}/api/note/sync`, {
      method: 'POST',
      headers: {
        Origin: origin,
        Cookie: alice.cookie,
        'Content-Type': 'application/json',
      },
      body: '{',
    })
    assert.equal(malformed.status, 400)
    assert.deepEqual(await malformed.json(), {status: 'invalid_input'})
  } finally {
    if (owners.length) {
      await db.delete(notesTable).where(inArray(notesTable.authorId, owners))
      await db.delete(usersTable).where(inArray(usersTable.id, owners))
    }
    await client.end()
  }
})
