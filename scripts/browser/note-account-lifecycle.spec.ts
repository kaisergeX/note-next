import {test, expect, body, title, drafts, fullPath} from './fixtures'
import type {Page} from '@playwright/test'

const exitDialog = (page: Page) =>
  page.getByRole('dialog', {name: 'You have local drafts', exact: true})
async function signOut(page: Page) {
  await page.getByRole('button', {name: 'Open user menu', exact: true}).click()
  await page.getByRole('button', {name: 'Sign Out', exact: true}).click()
  await expect(exitDialog(page)).toBeVisible()
}
async function localNote(page: Page, name: string) {
  await page.goto('/en/eton')
  await expect(
    page.getByRole('button', {name: 'New note', exact: true}),
  ).toBeVisible()
  await page.goto('/en/full/eton/new')
  await title(page).fill(name)
  await body(page).fill(`${name} content`)
  await expect
    .poll(async () =>
      (await drafts(page)).some((row) => row.draft.title?.includes(name)),
    )
    .toBe(true)
  await page
    .getByRole('button', {name: 'Save and go back', exact: true})
    .click()
  await expect(page).toHaveURL(/\/en\/eton$/)
}

for (const entry of ['notes', 'settings'] as const) {
  test(`logout Review from ${entry} shows only browser work without signing out`, async ({
    page,
    noteApp,
  }) => {
    const saved = await noteApp.create()
    const clean = await noteApp.create()
    await noteApp.save(clean, {title: '<p>Server-only note</p>'})
    await page.route('**/api/note/sync', (route) =>
      route.fulfill({status: 503, json: {status: 'retryable_error'}}),
    )
    await page.goto('/en/eton')
    await page.goto(
      entry === 'settings' ? fullPath(saved) : '/en/full/eton/new',
    )
    await title(page).fill('Review my browser work')
    await body(page).fill('Unsaved account work')
    await expect
      .poll(async () => (await drafts(page)).length)
      .toBeGreaterThan(0)
    await page
      .getByRole('button', {name: 'Save and go back', exact: true})
      .click()
    await expect(page).toHaveURL(/\/en\/eton$/)
    if (entry === 'settings') await page.goto('/en/settings/account')
    await page
      .getByRole('button', {name: 'Open user menu', exact: true})
      .click()
    await page.getByRole('button', {name: 'Sign Out', exact: true}).click()
    const dialog = page.getByRole('dialog', {
      name: 'You have local drafts',
      exact: true,
    })
    await expect(dialog).toBeVisible()
    if (entry === 'notes') {
      await dialog.getByRole('button', {name: 'Cancel', exact: true}).click()
      await expect(dialog).not.toBeVisible()
      await signOut(page)
    }
    await dialog.getByRole('link', {name: 'Review', exact: true}).click()
    await expect(dialog).not.toBeVisible()
    await expect(
      page.getByRole('heading', {name: 'Browser work', exact: true}),
    ).toBeVisible()
    await expect(page).toHaveURL(/\/en\/collection\/browser-work$/)
    await expect(
      page.getByRole('button', {name: 'New note', exact: true}),
    ).toHaveCount(0)
    await expect(
      page.getByRole('link').filter({hasText: 'Server-only note'}),
    ).toHaveCount(0)
    await expect(
      page.getByRole('link').filter({hasText: 'Review my browser work'}),
    ).toBeVisible()
    expect(
      (
        await page.request
          .get('/api/auth/session')
          .then((response) => response.json())
      ).user?.id,
    ).toBe(noteApp.ownerId)
    await page.getByRole('link', {name: 'Back to notes', exact: true}).click()
    await expect(
      page.getByRole('link').filter({hasText: 'Server-only note'}),
    ).toHaveCount(1)
    if (entry === 'settings') {
      await noteApp.read(saved.id)
      expect(
        (await page.request.get('/api/auth/session').then((r) => r.json())).user
          .id,
      ).toBe(noteApp.ownerId)
      await expect(
        page.getByRole('link').filter({hasText: 'Review my browser work'}),
      ).toHaveAttribute('href', `/en/eton/${saved.id}`)
    }
    await page
      .getByRole('link')
      .filter({hasText: 'Review my browser work'})
      .click()
    await expect(body(page)).toHaveText('Unsaved account work')
  })
}

test('real logout Keep retains work across accounts; Discard removes only the current account work', async ({
  page,
  noteApp,
  baseURL,
}) => {
  await page.route('**/api/note/sync', (route) =>
    route.fulfill({status: 503, json: {status: 'retryable_error'}}),
  )
  await localNote(page, 'Primary private draft')
  await signOut(page)
  await exitDialog(page)
    .getByRole('button', {name: 'Keep and continue', exact: true})
    .click()
  await expect
    .poll(
      async () =>
        (await page.request.get('/api/auth/session').then((r) => r.json()))
          ?.user ?? null,
    )
    .toBeNull()
  await expect(page).toHaveURL(/\/en\/?$/)
  await expect(
    page.getByRole('link', {name: 'Log in', exact: true}),
  ).toBeVisible()
  expect(new URL(page.url()).origin).toBe(baseURL)
  expect(
    (await drafts(page)).some((row) => row.ownerId === noteApp.ownerId),
  ).toBe(true)
  const secondId = await noteApp.signIn('secondary')
  await page.goto('/en/eton')
  await expect(
    page.getByText('Primary private draft', {exact: true}),
  ).toHaveCount(0)
  await localNote(page, 'Secondary private draft')
  await expect(
    page.getByRole('link').filter({hasText: 'Secondary private draft'}),
  ).toHaveCount(1)
  await expect(
    page.getByText('Primary private draft', {exact: true}),
  ).toHaveCount(0)
  await signOut(page)
  await exitDialog(page)
    .getByRole('button', {name: 'Discard', exact: true})
    .click()
  const confirm = page.getByRole('dialog', {
    name: 'Discard and continue?',
    exact: true,
  })
  await confirm
    .getByRole('contentinfo')
    .getByRole('button', {name: 'Cancel', exact: true})
    .click()
  await expect(exitDialog(page)).toBeVisible()
  expect((await drafts(page)).some((row) => row.ownerId === secondId)).toBe(
    true,
  )
  await exitDialog(page)
    .getByRole('button', {name: 'Discard', exact: true})
    .click()
  await confirm
    .getByRole('button', {name: 'Discard and continue', exact: true})
    .click()
  await expect
    .poll(
      async () =>
        (await page.request.get('/api/auth/session').then((r) => r.json()))
          ?.user ?? null,
    )
    .toBeNull()
  await expect(page).toHaveURL(/\/en\/?$/)
  await expect(
    page.getByRole('link', {name: 'Log in', exact: true}),
  ).toBeVisible()
  expect(new URL(page.url()).origin).toBe(baseURL)
  expect(
    (await drafts(page)).filter((row) => row.ownerId === secondId),
  ).toHaveLength(0)
  expect(
    (await drafts(page)).some((row) => row.ownerId === noteApp.ownerId),
  ).toBe(true)
  await noteApp.signIn()
  await page.goto('/en/eton')
  await page
    .getByRole('link')
    .filter({hasText: 'Primary private draft'})
    .click()
  await expect(body(page)).toHaveText('Primary private draft content')
  expect(await noteApp.all()).toHaveLength(0)
})

test('expired signed session rejects a real save and retains work for the same account after sign-in', async ({
  page,
  noteApp,
}) => {
  const saved = await noteApp.create()
  await page.route('**/api/note/sync', (route) =>
    route.fulfill({status: 503, json: {status: 'retryable_error'}}),
  )
  await page.goto(fullPath(saved))
  await body(page).fill('Work during session expiry')
  const retry = page.getByRole('button', {name: 'Retry', exact: true})
  await expect(retry).toBeVisible()
  await noteApp.signIn('primary', -120)
  await page.unroute('**/api/note/sync')
  const rejection = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/note/sync') && response.status() === 401,
  )
  await retry.click()
  await rejection
  await expect(body(page)).toHaveText('Work during session expiry')
  await expect(
    page.getByRole('alert').filter({hasText: 'Sign in again to sync.'}),
  ).toBeVisible()
  expect(
    (await drafts(page)).some(
      (row) =>
        row.ownerId === noteApp.ownerId &&
        row.draft.content === '<p>Work during session expiry</p>',
    ),
  ).toBe(true)
  expect(
    (await page.request.get('/api/auth/session').then((r) => r.json()))?.user ??
      null,
  ).toBeNull()
  await page.reload()
  await expect(page).toHaveURL(/\/login(?:\?|$)/)
  await noteApp.signIn()
  await page.goto(fullPath(saved))
  await expect(body(page)).toHaveText('Work during session expiry')
  await expect
    .poll(async () => (await noteApp.read(saved.id)).content)
    .toBe('<p>Work during session expiry</p>')
})

for (const view of ['collection', 'editor'] as const) {
  test(`a live account change hides the previous account ${view} and retains its recovery`, async ({
    page,
    noteApp,
  }) => {
    await page.route('**/api/note/sync', (route) =>
      route.fulfill({status: 503, json: {status: 'retryable_error'}}),
    )
    await localNote(page, 'Previous account local work')
    const card = page
      .getByRole('link')
      .filter({hasText: 'Previous account local work'})
    await expect(card).toHaveCount(1)
    if (view === 'editor') {
      await card.click()
      await expect(body(page)).toHaveText('Previous account local work content')
    }
    const secondId = await noteApp.signIn('secondary')
    const session = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/auth/session',
    )
    await page.evaluate(() =>
      document.dispatchEvent(new Event('visibilitychange')),
    )
    expect((await (await session).json()).user.id).toBe(secondId)
    await expect(card).toHaveCount(0)
    if (view === 'editor') {
      await expect(body(page)).toHaveCount(0)
      await page.goto('/en/eton')
    }
    await expect(
      page.getByText('Your next thought starts here.', {exact: true}),
    ).toBeVisible()
    expect(
      (await drafts(page))
        .filter((row) => row.ownerId === noteApp.ownerId)
        .map((row) => row.draft.content),
    ).toContain('<p>Previous account local work content</p>')
    await noteApp.signIn()
    await page.goto('/en/eton')
    expect(
      (await page.request.get('/api/auth/session').then((r) => r.json())).user
        .id,
    ).toBe(noteApp.ownerId)
    expect(
      (await drafts(page))
        .filter((row) => row.ownerId === noteApp.ownerId)
        .map((row) => row.draft.title),
    ).toContain('<p>Previous account local work</p>')
    await expect(card).toHaveCount(1)
  })
}
