import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {test as base, expect, type Page} from '@playwright/test'
import postgres from 'postgres'
import {drizzle} from 'drizzle-orm/postgres-js'
import {eq} from 'drizzle-orm'
import {encode} from 'next-auth/jwt'
import {usersTable} from '../../db/schema/users'
import {notesTable, type Note} from '../../db/schema/notes'
import type {RecoveryDraft} from '../../lib/notes/drafts'
import type {NoteSnapshot, SyncRequest, SyncResult} from '../../lib/notes/sync'

const databaseUrl = process.env.DATABASE_URL
assert.ok(databaseUrl, 'Load .env.local before running browser regressions.')
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(new URL(databaseUrl).hostname),
  'Browser fixtures require local PostgreSQL.',
)
const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
assert.ok(secret, 'A local auth secret is required.')

export async function drafts(page: Page): Promise<RecoveryDraft[]> {
  return page.evaluate(async () => {
    if (
      !(await indexedDB.databases()).some(
        (row) => row.name === 'etoN-note-recovery',
      )
    )
      return []
    return new Promise<RecoveryDraft[]>((resolve, reject) => {
      const request = indexedDB.open('etoN-note-recovery')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction('drafts')
        const rows = transaction.objectStore('drafts').getAll()
        rows.onsuccess = () => resolve(rows.result)
        rows.onerror = () => reject(rows.error)
        transaction.oncomplete = () => db.close()
      }
    })
  })
}

export const body = (page: Page) =>
  page.getByRole('textbox', {name: 'Note content', exact: true})
export const title = (page: Page) =>
  page.getByRole('textbox', {name: 'Title', exact: true})
export const fullPath = (note: Note) => `/en/full/eton/${note.id}`
export async function refresh(page: Page) {
  const response = page.waitForResponse(
    (response) =>
      response.request().headers().rsc === '1' &&
      new URL(response.url()).pathname === new URL(page.url()).pathname,
  )
  await page.evaluate(() => window.dispatchEvent(new Event('note-list-stale')))
  expect((await response).ok()).toBe(true)
  // Dev RSC streams can remain open. Allow rendering after response headers,
  // then exercise the editor/review UI rather than waiting for stream closure.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))),
      ),
  )
}
export const review = (page: Page) =>
  page.getByRole('dialog').filter({
    has: page.getByRole('heading', {
      name: 'This note changed elsewhere',
      exact: true,
    }),
  })

type NoteApp = {
  ownerId: string
  signIn: (
    account?: 'primary' | 'secondary',
    maxAge?: number,
  ) => Promise<string>
  create: () => Promise<Note>
  save: (note: Note, content: Partial<NoteSnapshot>) => Promise<Note>
  read: (id: string) => Promise<Note>
  all: () => Promise<Note[]>
  conflict: () => Promise<{original: Note; remote: Note; local: string}>
}

export const test = base.extend<{noteApp: NoteApp}>({
  noteApp: async ({page, context, baseURL}, run) => {
    const client = postgres(databaseUrl, {max: 2, onnotice: () => {}})
    const db = drizzle({client})
    const ownerIds: string[] = []
    try {
      const [user] = await db
        .insert(usersTable)
        .values({
          name: 'Browser regression fixture',
          email: `browser-${randomUUID()}@test.invalid`,
        })
        .returning()
      ownerIds.push(user.id)
      let secondary: typeof user | undefined
      const signIn: NoteApp['signIn'] = async (account = 'primary', maxAge) => {
        if (account === 'secondary' && !secondary) {
          const [created] = await db
            .insert(usersTable)
            .values({
              name: 'Browser account-switch fixture',
              email: `browser-${randomUUID()}@test.invalid`,
            })
            .returning()
          secondary = created
          ownerIds.push(secondary.id)
        }
        const selected = account === 'primary' ? user : secondary!
        const token = await encode({
          secret,
          salt: 'authjs.session-token',
          ...(maxAge === undefined ? {} : {maxAge}),
          token: {
            sub: 'browser-regression-fixture',
            userId: selected.id,
            email: selected.email,
            role: selected.role,
          },
        })
        await context.addCookies([
          {
            name: 'authjs.session-token',
            value: token,
            url: baseURL!,
            httpOnly: true,
            sameSite: 'Lax',
          },
        ])
        return selected.id
      }
      await signIn()
      const session = await context.request.get('/api/auth/session')
      expect(session.ok()).toBe(true)
      // Fail before note mutations if the server points at another DB/secret.
      expect((await session.json()).user?.id).toBe(user.id)
      const send = async (request: SyncRequest) => {
        const response = await context.request.post('/api/note/sync', {
          headers: {Origin: baseURL!},
          data: request,
        })
        expect(response.status()).toBe(200)
        const result = (await response.json()) as SyncResult
        expect(result.status).toBe('success')
        if (result.status !== 'success')
          throw new Error(`Fixture sync refused: ${result.status}`)
        return result.note
      }
      const save: NoteApp['save'] = (note, content) =>
        send({
          ownerId: user.id,
          noteId: note.id,
          creationId: randomUUID(),
          mutationId: randomUUID(),
          expectedRevision: note.revision,
          kind: 'save',
          content: {
            title: note.title,
            content: note.content,
            theme: note.theme,
            ...content,
          },
        })
      const read: NoteApp['read'] = async (id) => {
        const response = await context.request.get(`/api/note/${id}`)
        expect(response.status()).toBe(200)
        return response.json()
      }
      const create = () =>
        send({
          ownerId: user.id,
          noteId: null,
          creationId: randomUUID(),
          mutationId: randomUUID(),
          expectedRevision: null,
          kind: 'save',
          content: {
            title: '<p>Browser regression note</p>',
            content: '<p>Original body</p>',
            theme: null,
          },
        })
      await run({
        ownerId: user.id,
        signIn,
        create,
        save,
        read,
        all: () =>
          db.select().from(notesTable).where(eq(notesTable.authorId, user.id)),
        conflict: async () => {
          const original = await create()
          await page.goto(fullPath(original))
          await expect(body(page)).toHaveText('Original body')
          const remote = await save(original, {
            title: '<p>Independent saved title</p>',
            content: '<p>Saved elsewhere</p>',
          })
          const local = 'Local browser work'
          await body(page).fill(local)
          await expect(
            page.getByRole('button', {name: 'Review changes', exact: true}),
          ).toBeVisible()
          await expect
            .poll(async () =>
              (await drafts(page)).some(
                (row) =>
                  row.noteId === original.id &&
                  row.draft.content === `<p>${local}</p>` &&
                  row.conflict?.revision === remote.revision,
              ),
            )
            .toBe(true)
          return {original, remote, local}
        },
      })
    } finally {
      // Stop browser controllers before deleting their disposable account.
      try {
        await context.close()
      } finally {
        try {
          for (const ownerId of ownerIds)
            await db.transaction(async (tx) => {
              await tx
                .select({id: usersTable.id})
                .from(usersTable)
                .where(eq(usersTable.id, ownerId!))
                .for('update')
              await tx
                .delete(notesTable)
                .where(eq(notesTable.authorId, ownerId!))
              await tx.delete(usersTable).where(eq(usersTable.id, ownerId!))
            })
        } finally {
          await client.end()
        }
      }
    }
  },
})

export {expect}
