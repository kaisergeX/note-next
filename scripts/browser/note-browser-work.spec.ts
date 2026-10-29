import {test, expect, body, title, drafts, fullPath, review} from './fixtures'
import type {SyncRequest} from '../../lib/notes/sync'

const browserWork = '/en/collection/browser-work'

for (const savedNote of [false, true]) {
  test(`Browser work ${savedNote ? 'saved continuation' : 'new note'} returns to its collection after reload and close`, async ({
    page,
    noteApp,
  }) => {
    const saved = savedNote ? await noteApp.create() : undefined
    await page.route('**/api/note/sync', (route) =>
      route.fulfill({status: 503, json: {status: 'retryable_error'}}),
    )
    await page.goto('/en/eton')
    await page.goto(saved ? fullPath(saved) : '/en/full/eton/new')
    await title(page).fill('Browser work continuation')
    await body(page).fill('Continue from this collection')
    await expect
      .poll(async () =>
        (await drafts(page)).some(
          (row) => row.draft.content === '<p>Continue from this collection</p>',
        ),
      )
      .toBe(true)
    await page
      .getByRole('button', {name: 'Save and go back', exact: true})
      .click()
    await expect(page).toHaveURL(/\/en\/eton$/)
    await expect(body(page)).toHaveCount(0)
    await page.goto(browserWork)
    await expect(
      page.getByRole('button', {name: 'New note', exact: true}),
    ).toHaveCount(0)
    await page
      .getByRole('link')
      .filter({hasText: 'Browser work continuation'})
      .click()
    await expect(body(page)).toHaveText('Continue from this collection')
    expect(new URL(page.url()).searchParams.get('from')).toBe('browser-work')
    await page.reload()
    await expect(body(page)).toHaveText('Continue from this collection')
    await page
      .getByRole('button', {name: 'Save and go back', exact: true})
      .click()
    await expect(page).toHaveURL(new RegExp(`${browserWork}$`))
    await expect(
      page.getByRole('heading', {name: 'Browser work', exact: true}),
    ).toBeVisible()
    await page.getByRole('link', {name: 'Back to notes', exact: true}).click()
    await expect(page).toHaveURL(/\/en\/eton$/)
    await page.goto('/en/eton?work=browser')
    await expect(page).toHaveURL(new RegExp(`${browserWork}$`))
  })
}

test('Review later and Open saved retain Browser work context and competing versions', async ({
  page,
  context,
  noteApp,
}) => {
  const saved = await noteApp.create()
  await context.route('**/api/note/sync', (route) =>
    route.fulfill({status: 503, json: {status: 'retryable_error'}}),
  )
  await page.goto(fullPath(saved))
  await expect(body(page)).toHaveText('Original body')
  const second = await context.newPage()
  await second.goto(fullPath(saved))
  await expect(body(second)).toHaveText('Original body')
  await body(page).fill('First browser version')
  await body(second).fill('Second browser version')
  await expect
    .poll(
      async () =>
        new Set((await drafts(page)).map((row) => row.draft.content)).size,
    )
    .toBe(2)
  await second.close()
  await page.goto(browserWork)
  const card = page
    .getByRole('link')
    .filter({hasText: 'Browser regression note'})
  await card.click()
  await page.getByRole('button', {name: 'Review later', exact: true}).click()
  await expect(page).toHaveURL(new RegExp(`${browserWork}$`))

  const [record] = await drafts(page)
  const recoveryURL = `/en/full/eton/recover/${record.id}?review=1&from=browser-work`
  await page.goto(recoveryURL)
  await page.getByRole('button', {name: 'Review later', exact: true}).click()
  await expect(page).toHaveURL(new RegExp(`${browserWork}$`))
  await page.goto(recoveryURL)
  await page
    .getByRole('button', {name: 'Open saved version', exact: true})
    .click()
  await expect(body(page)).toHaveText('Original body')
  expect(new URL(page.url()).searchParams.get('from')).toBe('browser-work')
  await page
    .getByRole('button', {name: 'Save and go back', exact: true})
    .click()
  await expect(page).toHaveURL(new RegExp(`${browserWork}$`))
  expect(new Set((await drafts(page)).map((row) => row.draft.content))).toEqual(
    new Set(['<p>First browser version</p>', '<p>Second browser version</p>']),
  )

  await card.click()
  await page
    .getByRole('button', {name: 'Continue this version', exact: true})
    .click()
  await expect(body(page)).toHaveText(/^(First|Second) browser version$/)
  await page
    .getByRole('button', {name: 'Review other versions', exact: true})
    .click()
  const url = page.url()
  await page
    .getByRole('button', {name: 'Close comparison', exact: true})
    .click()
  expect(page.url()).toBe(url)
  await expect(body(page)).toHaveText(/^(First|Second) browser version$/)
  await page
    .getByRole('button', {name: 'Save and go back', exact: true})
    .click()
  await expect(page).toHaveURL(new RegExp(`${browserWork}$`))
  expect((await noteApp.read(saved.id)).revision).toBe(saved.revision)
})

test('Browser work conflict comparison and lost-response Keep both preserve the return destination', async ({
  page,
  noteApp,
}) => {
  const {original, remote, local} = await noteApp.conflict()
  await page.goto(browserWork)
  await page
    .getByRole('link')
    .filter({hasText: 'Independent saved title'})
    .click()
  await expect(review(page)).toBeVisible()
  await expect(
    review(page).getByRole('button', {name: 'Keep both', exact: true}),
  ).toBeEnabled()
  const url = page.url()
  await review(page)
    .getByRole('button', {name: 'Close comparison', exact: true})
    .click()
  expect(page.url()).toBe(url)
  await expect(body(page)).toHaveText(local)
  await page.getByRole('button', {name: 'Review changes', exact: true}).click()
  const creations: SyncRequest[] = []
  await page.route('**/api/note/sync', async (route) => {
    const request = route.request().postDataJSON() as SyncRequest
    if (!request.noteId) {
      creations.push(request)
      if (creations.length === 1) {
        const response = await route.fetch()
        expect((await response.json()).status).toBe('success')
        await route.abort('failed')
        return
      }
    }
    await route.continue()
  })
  await review(page)
    .getByRole('button', {name: 'Keep both', exact: true})
    .click()
  await expect(
    page.getByRole('button', {name: 'Retry', exact: true}),
  ).toBeVisible()
  await expect(page).toHaveURL(/\/full\/eton\/recover\//)
  expect(new URL(page.url()).searchParams.get('from')).toBe('browser-work')
  await page.reload()
  await expect(body(page)).toHaveText(local)
  await expect.poll(async () => (await noteApp.all()).length).toBe(2)
  await expect(page).toHaveURL(
    new RegExp(`/full/eton/${creations[0].creationId}\\?from=browser-work$`),
  )
  expect(creations).toHaveLength(2)
  expect(creations[1]).toEqual(creations[0])
  expect((await noteApp.read(original.id)).revision).toBe(remote.revision)
  await page
    .getByRole('button', {name: 'Save and go back', exact: true})
    .click()
  await expect(page).toHaveURL(new RegExp(`${browserWork}$`))
})
