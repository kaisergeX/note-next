import type {Page} from '@playwright/test'
import {test, expect} from './fixtures'
import en from '../../dictionaries/en.json' with {type: 'json'}
import vi from '../../dictionaries/vi.json' with {type: 'json'}

async function unlock(page: Page, phrase: string, messages = en.note) {
  const {vault} = messages
  await page.getByLabel(vault.passphrase, {exact: true}).fill(phrase)
  await page.getByRole('button', {name: vault.unlock, exact: true}).click()
  await expect(
    page.getByRole('button', {name: vault.lock, exact: true}),
  ).toBeVisible()
}

async function enroll(page: Page, locale: 'en' | 'vi' = 'en') {
  const messages = locale === 'en' ? en.note : vi.note
  const {vault} = messages
  const button = (name: string) => page.getByRole('button', {name, exact: true})
  await page.goto(`/${locale}/collection/encrypted`)
  await button(vault.setup).click()
  const phrase = await page.locator('p.font-mono').first().innerText()
  await button(vault.reveal).click()
  const recovery = await page.locator('p.font-mono').nth(1).innerText()
  const confirmation = page.getByLabel(vault.confirmationEntry, {exact: true})
  await confirmation.fill(phrase)
  await button(vault.verifyPrimary).click()
  await expect(button(vault.primaryVerified)).toBeVisible()
  await confirmation.fill(recovery)
  await button(vault.verifyRecovery).click()
  await expect(button(vault.recoveryVerified)).toBeVisible()
  await button(vault.activate).click()
  await unlock(page, phrase, messages)
  return phrase
}

async function saveNote(page: Page, text: string, messages = en.note) {
  const {encryptedEditor: editor, encryption} = messages
  await page.getByRole('button', {name: encryption.create, exact: true}).click()
  const title = page.getByRole('textbox', {name: editor.title, exact: true})
  await title.fill(text)
  await page
    .getByRole('textbox', {name: editor.body, exact: true})
    .fill('Original synthetic note')
  const sent = page.waitForRequest(
    (request) =>
      request.method() === 'PUT' &&
      new URL(request.url()).pathname.startsWith('/api/note-encryption/'),
  )
  await page.getByRole('button', {name: editor.save, exact: true}).click()
  const noteId = new URL((await sent).url()).pathname.split('/').at(-1)!
  await expect(
    page.getByRole('status').filter({hasText: editor.synced}),
  ).toBeVisible()
  await page.getByRole('button', {name: editor.close, exact: true}).click()
  return noteId
}

for (const creationEnabled of [true, false]) {
  test(`refused recovery uses the ${creationEnabled ? 'open' : 'closed'} creation flag across encrypted entry points`, async ({
    page,
    noteApp,
  }) => {
    const closedOrigin = process.env.NOTES_CLOSED_CREATION_ORIGIN
    test.skip(
      !creationEnabled && !closedOrigin,
      'Set NOTES_CLOSED_CREATION_ORIGIN to the local preview with creation disabled.',
    )
    test.setTimeout(120_000)
    expect(noteApp.ownerId).toBeTruthy()
    const phrase = await enroll(page)
    const {encryptedEditor: editor, encryption} = en.note
    const routes = [
      ['collection', '/en/collection/encrypted'],
      ['direct', '/en/eton/'],
      ['full', '/en/full/eton/'],
      ['modal', '/en/eton'],
    ] as const
    const notes = []
    for (const [surface, path] of routes) {
      const title = `Synthetic recovery from ${surface}`
      const id = await saveNote(page, title)
      notes.push({surface, path, title, id})
    }
    const origin = creationEnabled ? '' : closedOrigin!
    for (const {surface, path, title, id} of notes) {
      await page.goto(
        origin +
          (surface === 'direct' || surface === 'full' ? path + id : path),
      )
      if (surface === 'modal') {
        await page.locator(`a[data-note-id="${id}"]`).click()
        await expect(
          page.getByRole('dialog', {name: encryption.heading, exact: true}),
        ).toBeVisible()
      }
      await unlock(page, phrase)
      if (surface === 'collection') {
        await page.getByRole('button', {name: title, exact: true}).click()
      }
      const writes = `**/api/note-encryption/${id}`
      await page.route(writes, async (route) => {
        if (route.request().method() !== 'PUT') return route.continue()
        await route.fulfill({status: 400, json: {status: 'invalid_input'}})
      })
      await page
        .getByRole('textbox', {name: editor.body, exact: true})
        .fill('Refused synthetic edit')
      await page.getByRole('button', {name: editor.save, exact: true}).click()
      await expect(
        page.getByRole('heading', {name: editor.recoverHeading, exact: true}),
      ).toBeVisible()
      const copy = page.getByRole('button', {
        name: editor.recoverNew,
        exact: true,
      })
      const closed = page.getByText(editor.recoverCreationClosed, {exact: true})
      if (creationEnabled) {
        await expect(copy).toBeVisible()
        await expect(closed).toHaveCount(0)
      } else {
        await expect(copy).toHaveCount(0)
        await expect(closed).toBeVisible()
      }
      await page.unroute(writes)
    }
  })
}

test('mobile synced title wraps, keyboard open focuses the editor, and browser copies use the app locale', async ({
  page,
  noteApp,
}) => {
  test.setTimeout(90_000)
  expect(noteApp.ownerId).toBeTruthy()
  await page.setViewportSize({width: 390, height: 844})
  const {encryptedEditor: editor, encryption, vault} = vi.note
  const phrase = await enroll(page, 'vi')
  const longTitle = 'W'.repeat(120)
  await saveNote(page, longTitle, vi.note)
  const note = page.getByRole('button', {name: longTitle, exact: true})
  await expect(note).toBeVisible()
  const horizontalOverflow = () =>
    page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    )
  expect(await horizontalOverflow()).toBe(0)
  expect((await note.boundingBox())!.height).toBeGreaterThan(40)
  await note.press('Enter')
  const body = page.getByRole('textbox', {name: editor.body, exact: true})
  const title = page.getByRole('textbox', {name: editor.title, exact: true})
  await expect(title).toBeFocused()
  await expect(
    page.getByRole('button', {name: vault.lock, exact: true}),
  ).toBeVisible()
  await expect(
    page.getByLabel(vault.passphrase, {exact: true}),
  ).not.toBeVisible()
  await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}))
  await expect(title).toBeInViewport()
  await expect(body).toBeInViewport()
  expect(await horizontalOverflow()).toBe(0)

  const timestamp = '2026-11-19T03:45:00.000Z'
  await page.clock.setFixedTime(new Date(timestamp))
  await page.route('**/api/note-encryption/*', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue()
    await route.fulfill({status: 400, json: {status: 'invalid_input'}})
  })
  await body.fill('Synthetic browser copy')
  await page.getByRole('button', {name: editor.save, exact: true}).click()
  await expect(
    page.getByRole('heading', {name: editor.recoverHeading, exact: true}),
  ).toBeVisible()
  await page.getByRole('button', {name: vault.lock, exact: true}).click()
  await unlock(page, phrase, vi.note)
  await page.getByRole('button', {name: editor.close, exact: true}).click()
  const date = await page.evaluate(
    (value) =>
      new Intl.DateTimeFormat('vi', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(value)),
    timestamp,
  )
  await expect(
    page.getByRole('button', {
      name: encryption.localVersion.replace('{date}', date),
      exact: true,
    }),
  ).toBeVisible()
})
