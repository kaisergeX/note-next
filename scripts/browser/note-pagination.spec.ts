import {test, expect, body, title, drafts, fullPath} from './fixtures'
import type {Page} from '@playwright/test'

const cardsFor = (page: Page) =>
  page.locator('section[aria-label="Notes"] > ul > li')

test('automatic appends preserve the list scroll position through the final page', async ({
  page,
  noteApp,
}) => {
  await noteApp.createMany(60)
  const releases: (() => void)[] = []
  await page.route('**/api/note?cursor=*', async (route) => {
    await new Promise<void>((resolve) => releases.push(resolve))
    await route.continue()
  })
  try {
    await page.goto('/en/eton')
    const cards = cardsFor(page)
    await expect(cards).toHaveCount(24)
    for (const [index, count] of [48, 60].entries()) {
      await page
        .getByRole('button', {name: 'Load more notes', exact: true})
        .scrollIntoViewIfNeeded()
      await expect.poll(() => releases.length).toBe(index + 1)
      await expect(
        page.getByText('Loading more notes', {exact: true}),
      ).toBeVisible()
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      )
      const before = await page.evaluate(() => scrollY)
      expect(before).toBeGreaterThan(500)
      releases[index]()
      await expect(cards).toHaveCount(count)
      await page.evaluate(async () => {
        await document.activeViewTransition?.finished
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        )
      })
      expect(
        Math.abs((await page.evaluate(() => scrollY)) - before),
        `Page ${count}, scroll before ${before}, after ${await page.evaluate(() => scrollY)}`,
      ).toBeLessThan(4)
    }
  } finally {
    releases.forEach((release) => release())
  }
})

test('automatic next pages retain cards on failure, retry without duplicates, and scope cursors to the account', async ({
  page,
  context,
  noteApp,
}) => {
  const notes = await noteApp.createMany(60)
  const expected = notes
    .map((note) => note.id)
    .sort()
    .reverse()
  let fail = true
  await page.route('**/api/note?cursor=*', (route) =>
    fail
      ? route.fulfill({status: 503, json: {message: 'Temporary failure'}})
      : route.continue(),
  )
  await page.goto('/en/eton')
  const cards = cardsFor(page)
  await expect(cards).toHaveCount(24)
  await cards.last().scrollIntoViewIfNeeded()
  await expect(
    page.getByRole('alert').filter({hasText: 'Could not load notes'}),
  ).toBeVisible()
  await expect(cards).toHaveCount(24)
  fail = false
  await page.getByRole('button', {name: 'Retry loading notes'}).click()
  await expect(cards).toHaveCount(48)
  const links = cards.locator(':scope > div > a')
  expect(
    await links.evaluateAll((items) =>
      items.map((item) => item.getAttribute('href')),
    ),
  ).toEqual(expected.slice(0, 48).map((id) => `/en/eton/${id}`))
  await page
    .getByRole('button', {name: 'Load more notes', exact: true})
    .scrollIntoViewIfNeeded()
  await expect(cards).toHaveCount(60)
  await expect(page.getByRole('button', {name: 'Load more notes'})).toHaveCount(
    0,
  )
  const first = await context.request.get('/api/note')
  const initial = await first.json()
  expect(first.headers()['cache-control']).toBe('private, no-store')
  expect(initial.notes).toHaveLength(24)
  expect(initial.notes[0].content.length).toBeLessThanOrEqual(4106)
  expect((await context.request.get('/api/note?cursor=invalid')).status()).toBe(
    400,
  )
  await noteApp.signIn('secondary')
  const other = await context.request.get(
    `/api/note?cursor=${encodeURIComponent(JSON.stringify(initial.nextCursor))}`,
  )
  expect((await other.json()).notes).toEqual([])
  const resolved = await context.request.post('/api/note', {
    data: [expected.at(-1)],
  })
  expect((await resolved.json()).notes).toEqual([])
  await page.reload()
  await expect(cards).toHaveCount(0)
})

for (const mobile of [false, true]) {
  test(`returning from an older ${mobile ? 'mobile full-page' : 'desktop modal'} editor retains loaded pages`, async ({
    page,
    noteApp,
  }) => {
    if (mobile) await page.setViewportSize({width: 390, height: 844})
    const notes = await noteApp.createMany(60)
    await page.goto('/en/eton')
    const cards = cardsFor(page)
    await expect(cards).toHaveCount(24)
    await page
      .getByRole('button', {name: 'Load more notes', exact: true})
      .scrollIntoViewIfNeeded()
    await expect(cards).toHaveCount(48)
    const older = notes
      .map((note) => note.id)
      .sort()
      .reverse()[30]
    await cards.locator(`a[href="/en/eton/${older}"]`).click()
    await expect(body(page)).toBeVisible()
    await expect(body(page)).toContainText('Preview paragraph')
    await title(page).fill('Edited older note')
    await page
      .getByRole('button', {name: 'Save and go back', exact: true})
      .click()
    await expect(page).toHaveURL(/\/en\/eton$/)
    await expect(cards).toHaveCount(48)
    await expect(cards.filter({hasText: 'Edited older note'})).toHaveCount(1)
    await expect(cards.locator(`a[href="/en/eton/${older}"]`)).toBeInViewport()
  })
}

for (const lostCreation of [false, true]) {
  test(`a ${lostCreation ? 'lost creation response' : 'review draft'} outside the loaded pages opens the saved editor and appears once as pages arrive`, async ({
    page,
    noteApp,
  }) => {
    const notes = await noteApp.createMany(60)
    const old = notes.toSorted((a, b) => a.id.localeCompare(b.id))[0]
    await page.goto(fullPath(old))
    await expect(body(page)).toBeVisible()
    await page.route('**/api/note/sync', (route) =>
      route.fulfill({status: 503, json: {status: 'retryable_error'}}),
    )
    await title(page).fill('Older browser draft')
    await expect
      .poll(async () =>
        (await drafts(page)).some(
          (row) =>
            row.noteId === old.id &&
            row.draft.title?.includes('Older browser draft'),
        ),
      )
      .toBe(true)
    // A distinct second copy requires review, independent of pagination.
    await page.evaluate(
      async ({lostCreation, id}) => {
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.open('etoN-note-recovery')
          request.onsuccess = () => {
            const db = request.result
            const tx = db.transaction('drafts', 'readwrite')
            const store = tx.objectStore('drafts')
            const rows = store.getAll()
            rows.onsuccess = () => {
              const record = rows.result[0]
              if (lostCreation) {
                record.noteId = null
                record.creationId = id
                record.baseline = {}
                store.put(record)
              }
              store.put({
                ...record,
                id: crypto.randomUUID(),
                draft: {
                  ...record.draft,
                  content: '<p>Another browser version</p>',
                },
              })
            }
            tx.oncomplete = () => {
              db.close()
              resolve()
            }
            tx.onerror = () => reject(tx.error)
          }
          request.onerror = () => reject(request.error)
        })
      },
      {lostCreation, id: old.id},
    )
    await page.goto('/en/eton')
    const cards = cardsFor(page)
    await expect(cards).toHaveCount(25)
    await expect(
      page.getByRole('button', {name: 'Needs review 1'}),
    ).toBeVisible()
    await page.getByRole('button', {name: 'Needs review 1'}).click()
    await expect(cards).toHaveCount(1)
    const link = cards.locator(`a[data-note-id="${old.id}"]`)
    await expect(link).toHaveCount(1)
    await link.click()
    await expect(
      page
        .getByRole('button', {name: /^(Continue|Review) this version$/})
        .first(),
    ).toBeVisible()
    await page.getByRole('button', {name: 'Review later', exact: true}).click()
    await page.getByRole('button', {name: 'All notes', exact: true}).click()
    await page
      .getByRole('button', {name: 'Load more notes', exact: true})
      .scrollIntoViewIfNeeded()
    await expect(cards).toHaveCount(49)
    await page
      .getByRole('button', {name: 'Load more notes', exact: true})
      .scrollIntoViewIfNeeded()
    await expect(cards).toHaveCount(60)
    await expect(cards.locator(`a[data-note-id="${old.id}"]`)).toHaveCount(1)
    await page.goto('/en/collection/browser-work')
    await expect(
      page.locator(`a[href*="/full/eton/${old.id}?review=1"]`).first(),
    ).toBeVisible()
  })
}

test('trashing and restoring a paginated note survives another page and list navigation', async ({
  page,
  noteApp,
}) => {
  await page.emulateMedia({reducedMotion: 'reduce'})
  // Exercise the explicit fallback without racing automatic intersection loads.
  await page.addInitScript(() => {
    window.IntersectionObserver = class extends IntersectionObserver {
      observe() {}
    }
  })
  const notes = await noteApp.createMany(72)
  const removed = notes.toSorted((a, b) => b.id.localeCompare(a.id))[30]
  await page.goto('/en/eton')
  const cards = cardsFor(page)
  await expect(cards).toHaveCount(24)
  await page.getByRole('button', {name: 'Load more notes', exact: true}).click()
  await expect(cards).toHaveCount(48)
  const card = cards.filter({
    has: page.locator(`a[data-note-id="${removed.id}"]`),
  })
  await card
    .getByRole('button', {name: 'More note actions', exact: true})
    .click()
  await page
    .getByRole('button', {name: 'Move to Trash', exact: true})
    .press('Enter')
  await expect(card).toHaveCount(0)
  await expect(
    page.getByRole('button', {name: 'Load more notes', exact: true}),
  ).toBeEnabled()
  await page
    .getByRole('button', {name: 'Load more notes', exact: true})
    .press('Enter')
  await expect(cards).toHaveCount(71)
  await expect(card).toHaveCount(0)
  await page
    .getByRole('link', {name: 'Recently deleted', exact: true})
    .press('Enter')
  await page
    .getByRole('button', {
      name: `Restore “${removed.title!.replace(/<[^>]+>/g, '')}”`,
      exact: true,
    })
    .click()
  await page.getByRole('link', {name: 'All notes', exact: true}).press('Enter')
  await expect(cards).toHaveCount(72)
  await expect(card).toHaveCount(1)
})
