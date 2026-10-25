import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {test} from 'node:test'
import postgres from 'postgres'
import {drizzle} from 'drizzle-orm/postgres-js'
import {eq, and, sql} from 'drizzle-orm'
import {createNoteRepository} from '../db/repositories/notes'
import {usersTable} from '../db/schema/users'
import {notesTable} from '../db/schema/notes'
import {
  noteMutationSucceeded,
  type NoteMutationResult,
} from '../lib/notes/lifecycle'

// Explicit separate command: uses the existing development QA user and only
// creates/removes one uniquely identified note fixture. Never provisions users.
const origin = process.env.NOTES_TEST_ORIGIN
assert.ok(
  origin && process.env.DATABASE_URL,
  'Load the local app environment and set NOTES_TEST_ORIGIN explicitly',
)
assert.ok(
  ['localhost', '127.0.0.1'].includes(new URL(origin).hostname),
  'HTTP checks are local-only',
)
function success(result: NoteMutationResult) {
  assert.ok(noteMutationSucceeded(result), result.status)
  return result.note
}

test('authenticated app reads reconcile active/trash/restore/delete without cached note snapshots', async () => {
  const cron = await fetch(`${origin}/api/cron/note-cleanup`, {
    redirect: 'manual',
  })
  assert.ok(
    [401, 503].includes(cron.status),
    'Cron requires its own secret, never a login redirect',
  )
  assert.match(cron.headers.get('cache-control') ?? '', /no-store/)
  const cronHead = await fetch(`${origin}/api/cron/note-cleanup`, {
    method: 'HEAD',
    redirect: 'manual',
  })
  assert.equal(cronHead.status, 405, 'HEAD must not invoke cleanup')
  const client = postgres(process.env.DATABASE_URL!, {max: 1})
  const db = drizzle({client})
  const repo = createNoteRepository(db)
  let noteId: string | undefined
  let ownerId: string | undefined
  const cookies = new Map<string, string>()
  const receive = (response: Response) => {
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';')
      const index = pair.indexOf('=')
      cookies.set(pair.slice(0, index), pair.slice(index + 1))
    }
  }
  const headers = () => ({
    Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '),
  })
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, 'qa@test.dev'))
    assert.ok(
      user,
      'Ask the owner to provision qa@test.dev; this test never creates it',
    )
    ownerId = user.id
    const guest = await fetch(`${origin}/en/trash`, {redirect: 'manual'})
    assert.ok(
      guest.status === 307
        ? /login/.test(guest.headers.get('location') ?? '')
        : (await guest.text()).includes('/login'),
      'Trash requires authentication',
    )
    const csrf = await fetch(`${origin}/api/auth/csrf`)
    receive(csrf)
    const {csrfToken} = await csrf.json()
    const login = await fetch(`${origin}/api/auth/callback/credentials`, {
      method: 'POST',
      redirect: 'manual',
      headers: headers(),
      body: new URLSearchParams({
        csrfToken,
        email: 'qa@test.dev',
        password: 'qa',
        callbackUrl: `${origin}/en/eton`,
      }),
    })
    receive(login)
    const session = await fetch(`${origin}/api/auth/session`, {
      headers: headers(),
    })
    assert.equal((await session.json()).user?.email, 'qa@test.dev')
    const marker = `http-recovery-${randomUUID()}`
    const draftMarker = `restored-draft-${randomUUID()}`
    const note = success(
      await repo.createNote(user.id, {
        title: marker,
        content: 'fixture',
        theme: 'slate',
      }),
    )
    noteId = note.id
    const api = () =>
      fetch(`${origin}/api/note/${note.id}`, {headers: headers()})
    const page = (full = false) =>
      fetch(`${origin}/en/${full ? 'full/' : ''}eton/${note.id}`, {
        headers: headers(),
      })
    const first = await api()
    assert.equal(first.status, 200)
    assert.match(first.headers.get('cache-control') ?? '', /private.*no-store/)
    assert.equal((await first.json()).title, marker)
    assert.ok(
      (await (await page()).text()).includes(marker),
      'Active normal page must show the fixture',
    )
    const fullPage = await page(true)
    const fullHtml = await fullPage.text()
    // Redirects can stream as meta/RSC instructions after the shared shell starts.
    assert.ok(
      fullHtml.includes(`/eton/${note.id}`) || fullHtml.includes(marker),
      'Full route must redirect to the normal detail destination',
    )
    const trash = success(
      await repo.moveNoteToTrash(user.id, note.id, {
        title: draftMarker,
        content: 'saved with trash',
        theme: 'pink',
      }),
    )
    assert.equal((await api()).status, 404)
    const trashList = () => fetch(`${origin}/en/trash`, {headers: headers()})
    const preview = () =>
      fetch(`${origin}/en/trash/${note.id}`, {headers: headers()})
    assert.ok(
      (await (await trashList()).text()).includes(draftMarker),
      'Trash list shows recoverable notes',
    )
    const previewResponse = await preview()
    const previewHtml = await previewResponse.text()
    assert.ok(
      (previewResponse.redirected &&
        new URL(previewResponse.url).pathname === '/en/trash') ||
        /NEXT_REDIRECT;replace;\/en\/trash;307;/.test(previewHtml) ||
        /content="0;url=\/en\/trash"/.test(previewHtml),
      'Legacy preview route redirects to Trash, including a streamed redirect',
    )
    for (const full of [false, true]) {
      const html = await (await page(full)).text()
      assert.ok(
        !html.includes(marker) && !html.includes(draftMarker),
        'Trashed content must not be exposed',
      )
    }
    success(await repo.restoreNote(user.id, note.id, trash.deadlineToken))
    assert.equal((await (await api()).json()).title, draftMarker)
    assert.ok(
      !(await (await trashList()).text()).includes(draftMarker),
      'Restored note leaves Trash',
    )
    assert.ok(
      !(await (await preview()).text()).includes(draftMarker),
      'Restored note is unavailable in Trash preview',
    )
    assert.ok(
      (await (await page()).text()).includes(draftMarker),
      'Restoration must expose the saved draft, not the old active content',
    )
    const deletedCycle = success(await repo.moveNoteToTrash(user.id, note.id))
    success(
      await repo.permanentlyDeleteTrashedNote(
        user.id,
        note.id,
        deletedCycle.deadlineToken,
      ),
    )
    assert.equal((await api()).status, 404)
    assert.ok(!(await (await page()).text()).includes(draftMarker))
    const missing = await fetch(`${origin}/api/note/${randomUUID()}`, {
      headers: headers(),
    })
    const invalid = await fetch(`${origin}/api/note/malformed`, {
      headers: headers(),
    })
    assert.equal(missing.status, 404)
    assert.equal(invalid.status, 404)
    assert.deepEqual(await invalid.json(), await missing.json())
    const expiredMarker = `expired-${randomUUID()}`
    const expired = success(
      await repo.createNote(user.id, {title: expiredMarker}),
    )
    noteId = expired.id
    success(await repo.moveNoteToTrash(user.id, expired.id))
    await db
      .update(notesTable)
      .set({pendingDeleteAt: sql`now() - interval '1 second'`})
      .where(
        and(eq(notesTable.id, expired.id), eq(notesTable.authorId, user.id)),
      )
    assert.ok(!(await (await trashList()).text()).includes(expiredMarker))
    const expiredPreview = await fetch(`${origin}/en/trash/${expired.id}`, {
      headers: headers(),
    })
    assert.ok(!(await expiredPreview.text()).includes(expiredMarker))
  } finally {
    if (noteId && ownerId)
      await db
        .delete(notesTable)
        .where(and(eq(notesTable.id, noteId), eq(notesTable.authorId, ownerId)))
    await client.end()
  }
})
