import assert from 'node:assert/strict'
import {test} from 'node:test'
import {randomUUID} from 'node:crypto'
import postgres from 'postgres'
import {drizzle} from 'drizzle-orm/postgres-js'
import {eq, inArray} from 'drizzle-orm'
import {encode} from 'next-auth/jwt'
import {usersTable} from '../db/schema/users'
import {notesTable} from '../db/schema/notes'
import {featureAccessTable} from '../db/schema/feature-access'
import {userAppearanceTable} from '../db/schema/user-appearance'

// Explicit integration command. Only unique fixture accounts are written/deleted;
// no existing account, QA user, or feature grant is altered. Never run remotely.
const origin = process.env.ACCOUNT_TEST_ORIGIN
assert.ok(origin && process.env.DATABASE_URL)
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(
    new URL(process.env.DATABASE_URL).hostname,
  ),
)
const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
assert.ok(secret)
const client = postgres(process.env.DATABASE_URL, {max: 1, onnotice: () => {}})
const db = drizzle({client})

test('HTTP deletion enforces authentication, origin, verification and email; deleted sessions cannot access same-email signup', async () => {
  const fixtures: string[] = []
  let expectedOwnerId: string
  const email = `account-http-${randomUUID()}@test.invalid`
  const newUser = async () => {
    const [user] = await db
      .insert(usersTable)
      .values({name: 'Account HTTP fixture', email})
      .returning()
    fixtures.push(user.id)
    return user
  }
  const cookie = async (id: string, verifiedAt?: number) => {
    const token = await encode({
      secret,
      salt: 'authjs.session-token',
      token: {
        sub: 'http-fixture',
        userId: id,
        email,
        role: 'note-taker',
        accountDeleteVerifiedAt: verifiedAt,
      },
    })
    return `authjs.session-token=${token}`
  }
  const remove = (
    authCookie?: string,
    inputEmail = email,
    requestOrigin = origin,
  ) =>
    fetch(`${origin}/api/user/account`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Origin: requestOrigin!,
        ...(authCookie ? {Cookie: authCookie} : {}),
      },
      body: JSON.stringify({email: inputEmail, ownerId: expectedOwnerId}),
    })
  try {
    assert.equal((await remove()).status, 401)
    const user = await newUser()
    expectedOwnerId = user.id
    await db
      .insert(notesTable)
      .values({authorId: user.id, title: 'HTTP deletion fixture'})
    const unverified = await cookie(user.id)
    assert.equal((await remove(unverified)).status, 403)
    const expired = await cookie(user.id, Date.now() - 301000)
    assert.equal((await remove(expired)).status, 403)
    const verified = await cookie(user.id, Date.now())
    expectedOwnerId = randomUUID()
    assert.equal((await remove(verified)).status, 409)
    expectedOwnerId = user.id
    assert.equal(
      (await remove(verified, email, 'https://other.invalid')).status,
      403,
    )
    assert.equal((await remove(verified, 'wrong@test.invalid')).status, 400)
    // Client session-update data cannot mint a server verification timestamp.
    const csrfResponse = await fetch(`${origin}/api/auth/csrf`, {
      headers: {Cookie: unverified},
    })
    const {csrfToken} = await csrfResponse.json()
    const csrfCookie = csrfResponse.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ')
    const updated = await fetch(`${origin}/api/auth/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${unverified}; ${csrfCookie}`,
      },
      body: JSON.stringify({
        csrfToken,
        data: {accountDeleteVerifiedAt: Date.now(), user: {id: randomUUID()}},
      }),
    })
    const updatedSession = await updated.json()
    assert.equal(updatedSession.accountDeleteVerifiedAt, undefined)
    assert.equal(updatedSession.user.id, user.id)
    const deletion = await remove(verified)
    assert.equal(deletion.status, 200)
    assert.match(deletion.headers.get('cache-control')!, /no-store/)
    assert.equal(
      (
        await db
          .select()
          .from(notesTable)
          .where(eq(notesTable.authorId, user.id))
      ).length,
      0,
    )
    assert.equal((await remove(verified)).status, 401)
    const recreated = await newUser()
    assert.notEqual(recreated.id, user.id)
    const oldSession = await fetch(`${origin}/api/auth/session`, {
      headers: {Cookie: verified},
    })
    assert.equal(await oldSession.json(), null)
    const staleRead = await fetch(
      `${origin}/api/user/appearance?account=${encodeURIComponent(email)}`,
      {headers: {Cookie: verified}},
    )
    assert.equal(staleRead.status, 401)
    assert.equal((await remove(verified)).status, 401)
    const current = await fetch(`${origin}/api/auth/session`, {
      headers: {Cookie: await cookie(recreated.id)},
    })
    assert.equal((await current.json()).user.id, recreated.id)
  } finally {
    try {
      if (fixtures.length) {
        await db
          .delete(notesTable)
          .where(inArray(notesTable.authorId, fixtures))
        await db
          .delete(featureAccessTable)
          .where(inArray(featureAccessTable.userId, fixtures))
        await db
          .delete(userAppearanceTable)
          .where(inArray(userAppearanceTable.userId, fixtures))
        await db.delete(usersTable).where(inArray(usersTable.id, fixtures))
      }
    } finally {
      await client.end()
    }
  }
})
