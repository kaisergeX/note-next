import assert from 'node:assert/strict'
import postgres from 'postgres'
import {test, expect, body, drafts, fullPath} from './fixtures'

// Search browser verification must use the isolated app/test database, never
// migrate or seed the normal database used by an interactive development app.
const databaseUrl = process.env.DATABASE_URL
assert.ok(databaseUrl)
const database = new URL(databaseUrl)
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) &&
    /_test(?:_|$)/.test(database.pathname),
)

test('typing searches unloaded notes and visible inline text; Clear restores the loaded list', async ({
  page,
  noteApp,
}) => {
  await page.addInitScript(() => {
    window.IntersectionObserver = class extends IntersectionObserver {
      observe(target: Element) {
        if (target.matches('li')) super.observe(target)
      }
    }
  })
  const notes = []
  for (let index = 0; index < 52; index++) notes.push(await noteApp.create())
  const older = await noteApp.save(notes[0], {
    title: '<p>Unloaded search target</p>',
    content: `<p>${'intro '.repeat(1500)} hel<strong>lo</strong>世界 café 100% 🚀</p>`,
  })
  await page.goto('/en/eton')
  const target = page.locator(`a[data-note-id="${older.id}"]`)
  await expect(target).toHaveCount(0)
  const input = page.getByRole('searchbox', {name: 'Search notes', exact: true})
  await input.fill('hello世界')
  await expect(target).toBeVisible()
  await expect(target).toContainText('hello世界')
  await expect(
    page.getByRole('status').filter({hasText: '1 matching note'}),
  ).toBeVisible()
  await input.fill('cafe\u0301')
  await expect(target).toBeVisible()
  await input.fill('100%')
  await expect(target).toBeVisible()
  await input.fill('🚀')
  await expect(target).toBeVisible()
  await page.getByRole('button', {name: 'Clear', exact: true}).click()
  await expect(input).toHaveValue('')
  await expect(input).toBeFocused()
  await expect(target).toHaveCount(0)
  await input.fill('absent-needle')
  await expect(
    page.getByRole('status').filter({hasText: 'No matching notes.'}),
  ).toBeVisible()
  await input.press('Escape')
  await expect(input).toHaveValue('')
})

for (const mobile of [false, true]) {
  test(`search survives returning from the ${mobile ? 'mobile full-page' : 'desktop modal'} editor`, async ({
    page,
    noteApp,
  }) => {
    if (mobile) await page.setViewportSize({width: 390, height: 844})
    const original = await noteApp.create()
    const note = await noteApp.save(original, {
      content: '<p>return-search-needle</p>',
    })
    await page.goto('/en/eton')
    const input = page.getByRole('searchbox', {
      name: 'Search notes',
      exact: true,
    })
    await input.fill('return-search-needle')
    const target = page.locator(`a[data-note-id="${note.id}"]`)
    await expect(target).toBeVisible()
    await target.click()
    await expect(body(page)).toContainText('return-search-needle')
    await body(page).fill('Edited return-search-needle')
    await page
      .getByRole('button', {name: 'Save and go back', exact: true})
      .click()
    await expect(page).toHaveURL(/\/en\/eton$/)
    await expect(input).toHaveValue('return-search-needle')
    await expect(target).toBeInViewport()
    await expect(target).toContainText('Edited return-search-needle')
    await expect(target).toBeFocused()
  })
}

test('a displayed browser draft suppresses a stale server hit and supplies a new local match', async ({
  page,
  noteApp,
}) => {
  const original = await noteApp.create()
  const note = await noteApp.save(original, {
    content: '<p>server-only-needle</p>',
  })
  await page.goto(fullPath(note))
  await expect(body(page)).toBeVisible()
  await page.route('**/api/note/sync', (route) =>
    route.fulfill({status: 503, json: {status: 'retryable_error'}}),
  )
  await body(page).fill('browser-only-needle')
  await expect
    .poll(async () =>
      (await drafts(page)).some(
        (record) =>
          record.noteId === note.id &&
          record.draft.content?.includes('browser-only-needle'),
      ),
    )
    .toBe(true)
  await page.goto('/en/eton')
  const input = page.getByRole('searchbox', {name: 'Search notes', exact: true})
  const target = page.locator(`a[data-note-id="${note.id}"]`)
  await input.fill('server-only-needle')
  await expect(
    page.getByRole('status').filter({hasText: 'No matching notes.'}),
  ).toBeVisible()
  await expect(target).toHaveCount(0)
  await input.fill('browser-only-needle')
  await expect(target).toBeVisible()
  await expect(target).toContainText('browser-only-needle')
})

test('search and Needs review filter operate together on the displayed version', async ({
  page,
  noteApp,
}) => {
  const ordinary = await noteApp.create()
  await noteApp.save(ordinary, {
    content: '<p>Local browser work in another saved note</p>',
  })
  const conflict = await noteApp.conflict()
  await page.goto('/en/eton')
  await page
    .getByRole('searchbox', {name: 'Search notes', exact: true})
    .fill('Local browser work')
  await expect(
    page.getByRole('status').filter({hasText: '2 matching notes'}),
  ).toBeVisible()
  await page.getByRole('button', {name: 'Needs review 1', exact: true}).click()
  await expect(
    page.locator(`a[data-note-id="${conflict.original.id}"]`),
  ).toBeVisible()
  await expect(page.locator(`a[data-note-id="${ordinary.id}"]`)).toHaveCount(0)
  await expect(
    page.getByRole('status').filter({hasText: '1 matching note'}),
  ).toBeVisible()
})

test('encrypted title matches never inherit a body from the ordinary card preview', async ({
  page,
  noteApp,
  context,
}) => {
  const original = await noteApp.create()
  const note = await noteApp.save(original, {
    title: '<p>encrypted-title-needle</p>',
    content: '<p>previous-plaintext-secret</p>',
  })
  const client = postgres(databaseUrl, {max: 1})
  try {
    await client`UPDATE notes SET is_encrypted = true, content = 'opaque-encrypted-body' WHERE id = ${note.id} AND author_id = ${noteApp.ownerId}`
  } finally {
    await client.end()
  }
  const response = await context.request.post('/api/note/search', {
    data: {query: 'encrypted-title-needle', cursor: null},
  })
  expect(response.ok()).toBe(true)
  expect(response.headers()['cache-control']).toBe('private, no-store')
  const pageData = await response.json()
  expect(pageData.notes).toHaveLength(1)
  expect(pageData.notes[0]).toMatchObject({
    id: note.id,
    content: null,
    snippet: '',
    isEncrypted: true,
  })
  await page.goto('/en/eton')
  await page
    .getByRole('searchbox', {name: 'Search notes', exact: true})
    .fill('encrypted-title-needle')
  const target = page.locator(`a[data-note-id="${note.id}"]`)
  await expect(target).toBeVisible()
  await expect(target).not.toContainText('previous-plaintext-secret')
  await expect(target).not.toContainText('opaque-encrypted-body')
})

test('Vietnamese search reports no results and clears with localized controls', async ({
  page,
  noteApp,
}) => {
  await noteApp.create()
  await page.goto('/vi/eton')
  const input = page.getByRole('searchbox', {name: 'Tìm ghi chú', exact: true})
  await input.fill('không-có-nội-dung-này')
  await expect(
    page.getByRole('status').filter({hasText: 'Không có ghi chú phù hợp.'}),
  ).toBeVisible()
  await page.getByRole('button', {name: 'Xóa tìm kiếm', exact: true}).click()
  await expect(input).toHaveValue('')
  await expect(input).toBeFocused()
})

test('preparation failures preserve the query and retry without false no-results', async ({
  page,
  noteApp,
}) => {
  await noteApp.create()
  let preparing = true
  await page.route('**/api/note/search', (route) =>
    preparing
      ? route.fulfill({status: 503, json: {code: 'search_not_ready'}})
      : route.continue(),
  )
  await page.goto('/en/eton')
  const input = page.getByRole('searchbox', {name: 'Search notes', exact: true})
  await input.fill('Original body')
  await expect(
    page.getByRole('alert').filter({hasText: 'Search is being prepared.'}),
  ).toBeVisible()
  await expect(input).toHaveValue('Original body')
  await expect(
    page.getByText('No matching notes.', {exact: false}),
  ).toHaveCount(0)
  preparing = false
  await page
    .getByRole('button', {name: 'Try again', exact: true})
    .first()
    .click()
  await expect(
    page.getByRole('status').filter({hasText: '1 matching note'}),
  ).toBeVisible()
})

test('switching accounts resets search state and cannot display the previous account results', async ({
  page,
  noteApp,
}) => {
  await noteApp.create()
  await page.goto('/en/eton')
  const input = page.getByRole('searchbox', {name: 'Search notes', exact: true})
  await input.fill('Original body')
  await expect(
    page.getByRole('status').filter({hasText: '1 matching note'}),
  ).toBeVisible()
  await noteApp.signIn('secondary')
  await page.reload()
  await expect(input).toHaveValue('')
  await expect(page.locator('a[data-note-id]')).toHaveCount(0)
  await input.fill('Original body')
  await expect(
    page.getByRole('status').filter({hasText: 'No matching notes.'}),
  ).toBeVisible()
})

test('an older acknowledged search card cannot survive a later authoritative edit or trash', async ({
  page,
  noteApp,
}) => {
  const original = await noteApp.create()
  const targetNote = await noteApp.save(original, {
    content: '<p>older-acknowledgement-needle</p>',
  })
  for (let index = 0; index < 26; index++) await noteApp.create()
  await page.goto('/en/eton')
  const input = page.getByRole('searchbox', {name: 'Search notes', exact: true})
  await input.fill('older-acknowledgement-needle')
  const target = page.locator(`a[data-note-id="${targetNote.id}"]`)
  await target.click()
  await body(page).fill('Edited older-acknowledgement-needle')
  await page
    .getByRole('button', {name: 'Save and go back', exact: true})
    .click()
  await expect(input).toHaveValue('older-acknowledgement-needle')
  await expect(target).toBeVisible()
  await expect(
    page.getByRole('status').filter({hasText: '1 matching note'}),
  ).toBeVisible()
  await expect
    .poll(
      async () =>
        (await drafts(page)).filter((record) => record.noteId === targetNote.id)
          .length,
    )
    .toBe(0)
  await noteApp.save(await noteApp.read(targetNote.id), {
    content: '<p>changed elsewhere with no matching phrase</p>',
  })
  await page.evaluate(() => window.dispatchEvent(new Event('note-list-stale')))
  await expect(
    page.getByRole('status').filter({hasText: 'No matching notes.'}),
  ).toBeVisible()
  await expect(target).toHaveCount(0)
})

test('long search results keep card bodies bounded and restore their mounted return target', async ({
  page,
  noteApp,
}) => {
  test.setTimeout(120000)
  for (let index = 0; index < 160; index++) await noteApp.create()
  await page.addInitScript(() => {
    window.IntersectionObserver = class extends IntersectionObserver {
      observe(target: Element) {
        if (target.matches('li')) super.observe(target)
      }
    }
  })
  await page.goto('/en/eton')
  const input = page.getByRole('searchbox', {name: 'Search notes', exact: true})
  await input.fill('Original body')
  const list = page.locator('ul[data-masonry]')
  for (let loaded = 24; loaded < 160; loaded += 24) {
    await expect(list.locator('li').first()).toHaveAttribute(
      'aria-setsize',
      String(loaded),
    )
    await page
      .getByRole('button', {name: 'Load more matches', exact: true})
      .click()
  }
  await expect(list.locator('li').first()).toHaveAttribute(
    'aria-setsize',
    '160',
  )
  await expect
    .poll(() => list.locator('a[data-note-id]').count())
    .toBeLessThan(100)
  await page.evaluate(() =>
    scrollTo({top: document.body.scrollHeight * 0.7, behavior: 'instant'}),
  )
  const id = await list.locator('a[data-note-id]').evaluateAll((anchors) =>
    anchors
      .find((anchor) => {
        const rect = anchor.getBoundingClientRect()
        return rect.top >= 120 && rect.bottom < innerHeight - 80
      })
      ?.getAttribute('data-note-id'),
  )
  expect(id).toBeTruthy()
  const target = page.locator(`a[data-note-id="${id}"]`)
  await target.click()
  await expect(body(page)).toBeVisible()
  await page
    .getByRole('button', {name: 'Save and go back', exact: true})
    .click()
  await expect(input).toHaveValue('Original body')
  await expect(target).toBeInViewport()
  await expect(target).toBeFocused()
  await expect
    .poll(() => list.locator('a[data-note-id]').count())
    .toBeLessThan(100)
})
