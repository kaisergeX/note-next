import {test, expect, body, title, drafts, fullPath} from './fixtures'
import type {SyncRequest} from '../../lib/notes/sync'

for (const browserWork of [false, true]) {
  test(`direct note entry and reload return to ${browserWork ? 'Browser work' : 'Notes'} instead of unrelated history`, async ({
    page,
    noteApp,
  }) => {
    const note = await noteApp.create()
    await page.goto('/en/settings/appearance')
    await page.goto(
      `${fullPath(note)}${browserWork ? '?from=browser-work' : ''}`,
    )
    await expect(body(page)).toBeVisible()
    await page.reload()
    await expect(body(page)).toBeVisible()
    await page
      .getByRole('button', {name: 'Save and go back', exact: true})
      .click()
    await expect(page).toHaveURL(
      browserWork ? /\/en\/collection\/browser-work$/ : /\/en\/eton$/,
    )
  })
}

test('a note opened in a fresh tab has an in-app return destination', async ({
  page,
  noteApp,
}) => {
  const note = await noteApp.create()
  await page.goto(fullPath(note))
  await expect(body(page)).toBeVisible()
  await page
    .getByRole('button', {name: 'Save and go back', exact: true})
    .click()
  await expect(page).toHaveURL(/\/en\/eton$/)
})

test('intercepted note dismissal restores the collection', async ({
  page,
  noteApp,
}) => {
  const note = await noteApp.create()
  await page.goto('/en/eton')
  await page.locator(`a[href="/en/eton/${note.id}"]`).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page
    .getByRole('button', {name: 'Save and go back', exact: true})
    .click()
  await expect(page).toHaveURL(/\/en\/eton$/)
  await expect(page.getByRole('dialog')).not.toBeVisible()
})

test('a directly opened missing page provides a localized in-app back link', async ({
  page,
}) => {
  await page.goto('/vi/missing-navigation-test')
  const back = page.getByRole('link', {name: 'Quay lại', exact: true})
  await expect(back).toHaveAttribute('href', /^\/vi\/?$/)
  await back.click()
  await expect(page).toHaveURL(/\/vi\/?$/)
})

for (const inFlight of [false, true]) {
  test(`closing recovered creation ${inFlight ? 'waits for an in-flight retry' : 'starts the retry'} and returns to Notes`, async ({
    page,
    noteApp,
  }) => {
    let save = false
    let release!: () => void
    const responseGate = new Promise<void>((resolve) => {
      release = resolve
    })
    let committed!: () => void
    const creationCommitted = new Promise<void>((resolve) => {
      committed = resolve
    })
    const requests: SyncRequest[] = []
    await page.route('**/api/note/sync', async (route) => {
      if (!save) {
        await route.fulfill({status: 503, json: {status: 'retryable_error'}})
        return
      }
      requests.push(route.request().postDataJSON() as SyncRequest)
      const response = await route.fetch()
      expect((await response.json()).status).toBe('success')
      committed()
      await responseGate
      await route.fulfill({response})
    })
    await page.goto('/en/eton')
    await page.goto('/en/full/eton/new')
    await title(page).fill('Close during creation')
    await body(page).fill('Retain this browser work')
    await expect
      .poll(async () =>
        (await drafts(page)).some(
          (row) =>
            !row.noteId &&
            row.draft.content === '<p>Retain this browser work</p>',
        ),
      )
      .toBe(true)
    const close = page.getByRole('button', {
      name: 'Save and go back',
      exact: true,
    })
    await close.click()
    await expect(page).toHaveURL(/\/en\/eton$/)
    await page
      .getByRole('link')
      .filter({hasText: 'Close during creation'})
      .click()
    await expect(body(page)).toHaveText('Retain this browser work')
    await expect(page).toHaveURL(/\/recover\/[^?]+\?draft=/)
    // Hydration installs a durable continuation before retry/close can run.
    await expect(
      page.getByRole('button', {name: 'Retry', exact: true}),
    ).toBeVisible()
    save = true
    if (inFlight) {
      await page.getByRole('button', {name: 'Retry', exact: true}).click()
      await creationCommitted
    }
    await close.click()
    await expect(close).toBeDisabled()
    await creationCommitted
    release()
    await expect(page).toHaveURL(/\/en\/eton$/)
    await expect(body(page)).toHaveCount(0)
    const card = page
      .getByRole('link')
      .filter({hasText: 'Close during creation'})
    await expect(card).toHaveCount(1)
    expect(requests).toHaveLength(1)
    const notes = await noteApp.all()
    expect(notes).toHaveLength(1)
    expect(notes[0].content).toBe('<p>Retain this browser work</p>')
    await page.reload()
    await expect(page).toHaveURL(/\/en\/eton$/)
    await expect(card).toHaveCount(1)
    await card.click()
    await expect(body(page)).toHaveText('Retain this browser work')
  })
}
