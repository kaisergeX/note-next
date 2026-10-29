import {
  test,
  expect,
  body,
  title,
  drafts,
  fullPath,
  refresh,
  review,
} from './fixtures'
import type {SyncRequest} from '../../lib/notes/sync'

test('failed sync survives close, Notes reopening, modal/full handoff and reload', async ({
  page,
  noteApp,
}) => {
  const note = await noteApp.create()
  await page.route('**/api/note/sync', (route) =>
    route.fulfill({status: 503, json: {status: 'retryable_error'}}),
  )
  await page.goto('/en/eton')
  await page.goto(fullPath(note))
  await body(page).fill('Browser continuation')
  await expect
    .poll(async () =>
      (await drafts(page)).some(
        (row) =>
          row.noteId === note.id &&
          row.draft.content === '<p>Browser continuation</p>',
      ),
    )
    .toBe(true)
  await page
    .getByRole('button', {name: 'Save and go back', exact: true})
    .click()
  await expect(page).toHaveURL(/\/en\/eton$/)
  const card = page.getByRole('link').filter({hasText: 'Browser continuation'})
  await expect(card).toHaveCount(1)
  await card.click()
  await expect(body(page)).toHaveText('Browser continuation')
  await page.getByRole('link', {name: 'Full page view', exact: true}).click()
  await expect(page).toHaveURL(new RegExp(`/full/eton/${note.id}$`))
  await expect(body(page)).toHaveText('Browser continuation')
  await page.reload()
  await expect(body(page)).toHaveText('Browser continuation')
  expect((await noteApp.read(note.id)).content).toBe(note.content)
})

test('browser-only note gets a durable recovery URL and one server identity after retry', async ({
  page,
  noteApp,
}) => {
  await page.route('**/api/note/sync', (route) =>
    route.fulfill({status: 503, json: {status: 'retryable_error'}}),
  )
  await page.goto('/en/eton')
  await page.goto('/en/full/eton/new')
  await title(page).fill('Browser-only note')
  await body(page).fill('Not on the server yet')
  await expect
    .poll(async () =>
      (await drafts(page)).some(
        (row) =>
          !row.noteId && row.draft.content === '<p>Not on the server yet</p>',
      ),
    )
    .toBe(true)
  await page
    .getByRole('button', {name: 'Save and go back', exact: true})
    .click()
  await page.getByRole('link').filter({hasText: 'Browser-only note'}).click()
  await expect(page).toHaveURL(/\/recover\/[^?]+\?draft=/)
  await expect(body(page)).toHaveText('Not on the server yet')
  const durableURL = page.url()
  await page.reload()
  await expect(body(page)).toHaveText('Not on the server yet')
  expect(page.url()).not.toBe(durableURL) // source ID is retired only after durable resumption
  await expect(page).toHaveURL(/\?draft=/)
  await page.unroute('**/api/note/sync')
  await page
    .getByRole('button', {name: 'Save and go back', exact: true})
    .click()
  await expect.poll(async () => (await noteApp.all()).length).toBe(1)
  await expect(
    page.getByRole('link').filter({hasText: 'Browser-only note'}),
  ).toHaveCount(1)
  const [saved] = await noteApp.all()
  expect(saved.content).toBe('<p>Not on the server yet</p>')
})

test('conflict reload and RSC refresh retain local work, independent fields and editor identity', async ({
  page,
  noteApp,
}) => {
  const {original, remote, local} = await noteApp.conflict()
  await page.reload()
  await expect(body(page)).toHaveText(local)
  await expect(title(page)).toHaveText('Independent saved title')
  const editor = await body(page).elementHandle()
  await refresh(page)
  await expect
    .poll(() => editor!.evaluate((element) => element.isConnected))
    .toBe(true)
  await page.getByRole('button', {name: 'Review changes', exact: true}).click()
  await expect(
    review(page).getByRole('region', {name: 'Saved version', exact: true}),
  ).toContainText('Saved elsewhere')
  await review(page)
    .getByRole('button', {name: 'Close comparison', exact: true})
    .click()
  await page.reload()
  await expect(body(page)).toHaveText(local)
  expect((await noteApp.read(original.id)).revision).toBe(remote.revision)
})

test('Use mine rejects a newer server edit and only saves against the newly displayed revision', async ({
  page,
  noteApp,
}) => {
  const {original, remote, local} = await noteApp.conflict()
  await page.getByRole('button', {name: 'Review changes', exact: true}).click()
  const dialog = review(page)
  await expect(
    dialog.getByRole('button', {name: 'Use mine', exact: true}),
  ).toBeEnabled()
  const newer = await noteApp.save(remote, {
    content: '<p>Changed during review</p>',
  })
  const rejection = page.waitForResponse(
    async (response) =>
      response.url().endsWith('/api/note/sync') &&
      (await response.json()).status === 'conflict',
  )
  await dialog.getByRole('button', {name: 'Use mine', exact: true}).click()
  await rejection
  await expect(
    dialog.getByRole('region', {name: 'Saved version', exact: true}),
  ).toContainText('Changed during review')
  expect((await noteApp.read(original.id)).revision).toBe(newer.revision)
  await expect(body(page)).toHaveText(local)
  const accepted = page.waitForRequest(
    (request) =>
      request.url().endsWith('/api/note/sync') && request.method() === 'POST',
  )
  const acknowledged = page.waitForResponse((response) =>
    response.url().endsWith('/api/note/sync'),
  )
  await dialog.getByRole('button', {name: 'Use mine', exact: true}).click()
  expect((await accepted).postDataJSON().expectedRevision).toBe(newer.revision)
  expect((await (await acknowledged).json()).status).toBe('success')
  await expect(dialog).not.toBeVisible()
  expect((await noteApp.read(original.id)).content).toBe(`<p>${local}</p>`)
})

test('Use saved requires discard confirmation and rechecks freshness before replacing local work', async ({
  page,
  noteApp,
}) => {
  const {original, remote, local} = await noteApp.conflict()
  await page.getByRole('button', {name: 'Review changes', exact: true}).click()
  const dialog = review(page)
  await expect(
    dialog.getByRole('button', {name: 'Use saved', exact: true}),
  ).toBeEnabled()
  const newer = await noteApp.save(remote, {
    content: '<p>Saved again during review</p>',
  })
  await dialog.getByRole('button', {name: 'Use saved', exact: true}).click()
  await expect(body(page)).toHaveText(local)
  await dialog
    .getByRole('button', {
      name: 'Discard my changes and use saved',
      exact: true,
    })
    .click()
  await expect(
    dialog.getByRole('region', {name: 'Saved version', exact: true}),
  ).toContainText('Saved again during review')
  await expect(body(page)).toHaveText(local)
  expect((await noteApp.read(original.id)).revision).toBe(newer.revision)
  await dialog
    .getByRole('button', {
      name: 'Discard my changes and use saved',
      exact: true,
    })
    .click()
  await expect(dialog).not.toBeVisible()
  await expect(body(page)).toHaveText('Saved again during review')
  await expect
    .poll(
      async () =>
        (await drafts(page)).filter((row) => row.noteId === original.id).length,
    )
    .toBe(0)
  expect((await noteApp.read(original.id)).revision).toBe(newer.revision)
})

for (const reloadBeforeRetry of [false, true]) {
  test(`Keep both retries a lost creation response ${reloadBeforeRetry ? 'after reload' : 'in place'} without duplicates or changing the original`, async ({
    page,
    noteApp,
  }) => {
    const {original, remote, local} = await noteApp.conflict()
    await page
      .getByRole('button', {name: 'Review changes', exact: true})
      .click()
    const dialog = review(page)
    await expect(
      dialog.getByRole('button', {name: 'Keep both', exact: true}),
    ).toBeEnabled()
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
    await dialog.getByRole('button', {name: 'Keep both', exact: true}).click()
    await expect(
      page.getByRole('button', {name: 'Retry', exact: true}),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/full\/eton\/recover\//)
    if (reloadBeforeRetry) {
      await page.reload()
      await expect(body(page)).toHaveText(local)
    } else await page.getByRole('button', {name: 'Retry', exact: true}).click()
    await expect.poll(async () => (await noteApp.all()).length).toBe(2)
    await expect(page).toHaveURL(
      new RegExp(`/full/eton/${creations[0].creationId}$`),
    )
    expect(creations).toHaveLength(2)
    expect(creations[1]).toEqual(creations[0])
    expect((await noteApp.read(original.id)).revision).toBe(remote.revision)
    expect((await noteApp.read(creations[0].creationId)).content).toBe(
      `<p>${local}</p>`,
    )
    await expect(body(page)).toHaveText(local)
  })
}

test('failed freshness read blocks decisions, preserves local work, and can retry', async ({
  page,
  noteApp,
}) => {
  const {original, local} = await noteApp.conflict()
  const path = `**/api/note/${original.id}`
  await page.route(path, (route) =>
    route.fulfill({status: 503, json: {message: 'Temporary test failure'}}),
  )
  await page.getByRole('button', {name: 'Review changes', exact: true}).click()
  const dialog = review(page)
  await expect(dialog.getByRole('alert')).toBeVisible()
  for (const name of ['Use mine', 'Use saved', 'Keep both'])
    await expect(dialog.getByRole('button', {name, exact: true})).toBeDisabled()
  await expect(body(page)).toHaveText(local)
  expect(
    (await drafts(page)).some(
      (row) => row.noteId === original.id && !row.unavailable,
    ),
  ).toBe(true)
  await page.unroute(path)
  await dialog.getByRole('button', {name: 'Retry', exact: true}).click()
  await expect(
    dialog.getByRole('button', {name: 'Use mine', exact: true}),
  ).toBeEnabled()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
})

test('direct Open saved keeps competing browser versions through navigation and RSC refresh', async ({
  page,
  context,
  noteApp,
}) => {
  const note = await noteApp.create()
  await context.route('**/api/note/sync', (route) =>
    route.fulfill({status: 503, json: {status: 'retryable_error'}}),
  )
  await page.goto(fullPath(note))
  await expect(body(page)).toHaveText('Original body')
  const second = await context.newPage()
  await second.goto(fullPath(note))
  await expect(body(second)).toHaveText('Original body')
  await body(page).fill('First local version')
  await body(second).fill('Second local version')
  await expect
    .poll(
      async () =>
        new Set((await drafts(page)).map((row) => row.draft.content)).size,
    )
    .toBe(2)
  const [record] = await drafts(page)
  await second.close()
  await page.goto(`/en/full/eton/recover/${record.id}?review=1`)
  await page
    .getByRole('button', {name: 'Open saved version', exact: true})
    .click()
  await expect(page).toHaveURL(new RegExp(`/full/eton/${note.id}$`))
  await expect(body(page)).toHaveText('Original body')
  await refresh(page)
  await expect(
    page.getByRole('button', {name: 'Review other versions', exact: true}),
  ).toBeVisible()
  expect(new Set((await drafts(page)).map((row) => row.draft.content))).toEqual(
    new Set(['<p>First local version</p>', '<p>Second local version</p>']),
  )
  await page
    .getByRole('button', {name: 'Review other versions', exact: true})
    .click()
  await expect(
    page
      .locator('dialog[open]')
      .getByRole('button', {name: 'Continue this version', exact: true}),
  ).toBeVisible()
  expect((await noteApp.read(note.id)).revision).toBe(note.revision)
})
