import assert from 'node:assert/strict'

// Pass a Playwright Browser. This intentionally uses only the local dev QA provider.
export async function verifyAppearanceOffline(
  browser,
  baseURL = 'http://localhost:3000',
) {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname))
  const context = await browser.newContext()
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  let original
  const logs = []
  const endpoint = '/api/user/appearance?account=qa%40test.dev'
  const state = () =>
    page.evaluate(() => ({
      appearance: document.documentElement.dataset.appearance,
      status: document.querySelector('[role="status"]')?.textContent,
      cache: JSON.parse(
        localStorage.getItem('etoN-appearance-account:qa@test.dev') || 'null',
      ),
      owner: sessionStorage.getItem('etoN-appearance-session-account'),
    }))
  const choose = (name) =>
    page
      .locator('label')
      .filter({has: page.getByRole('radio', {name, exact: true})})
      .click()
  try {
    await page.goto(`${baseURL}/en/settings/appearance`)
    await page.evaluate(async () => {
      const {csrfToken} = await (await fetch('/api/auth/csrf')).json()
      await fetch('/api/auth/callback/credentials', {
        method: 'POST',
        body: new URLSearchParams({
          csrfToken,
          email: 'qa@test.dev',
          password: 'qa',
          callbackUrl: location.href,
        }),
      })
    })
    await page.reload()
    await page
      .getByText('Appearance saved to your account.', {exact: true})
      .waitFor()
    original = (
      await page.evaluate(async (url) => (await fetch(url)).json(), endpoint)
    ).preference
    await choose('Sepia')
    await page
      .getByText('Appearance saved to your account.', {exact: true})
      .waitFor()
    logs.push({step: 'online Sepia', ...(await state())})

    await context.setOffline(true)
    // Returning from DevTools/another tab forces Auth.js to refetch the session.
    // That failed fetch was the missing lifecycle path in the queue unit tests.
    const failedSession = page.waitForEvent('requestfailed', {
      predicate: (request) =>
        new URL(request.url()).pathname === '/api/auth/session',
    })
    await page.evaluate(() =>
      document.dispatchEvent(new Event('visibilitychange')),
    )
    await failedSession
    await page.waitForTimeout(300)
    await choose('Midnight')
    const offline = await state()
    logs.push({
      step: 'offline Midnight after failed session refresh',
      ...offline,
    })
    assert.equal(offline.appearance, 'midnight')
    assert.equal(offline.cache.appearance, 'midnight')
    assert.equal(offline.cache.pending, true)
    assert.match(offline.status, /Offline/)

    await context.setOffline(false)
    await page
      .getByText('Appearance saved to your account.', {exact: true})
      .waitFor()
    const online = await state()
    logs.push({step: 'reconnected', ...online})
    assert.equal(online.appearance, 'midnight')
    assert.equal(online.cache.pending, false)
    const remote = await page.evaluate(
      async (url) => (await fetch(url)).json(),
      endpoint,
    )
    assert.equal(remote.preference.appearance, 'midnight')

    // A fresh browser context represents another device without local preferences.
    const second = await browser.newContext({
      storageState: {cookies: await context.cookies(), origins: []},
    })
    try {
      const otherPage = await second.newPage()
      await otherPage.goto(`${baseURL}/en/settings/appearance`)
      await otherPage
        .getByText('Appearance saved to your account.', {exact: true})
        .waitFor()
      assert.equal(
        await otherPage.evaluate(
          () => document.documentElement.dataset.appearance,
        ),
        'midnight',
      )
      logs.push({step: 'second device', appearance: 'midnight'})
    } finally {
      await second.close()
    }

    await page.reload()
    await page
      .getByText('Appearance saved to your account.', {exact: true})
      .waitFor()
    assert.equal((await state()).appearance, 'midnight')
    logs.push({step: 'reload', appearance: 'midnight'})

    // Transport failures can also happen while navigator.onLine remains true.
    await context.route('**/api/**', (route) => route.abort())
    const unavailableSession = page.waitForEvent('requestfailed', {
      predicate: (request) =>
        new URL(request.url()).pathname === '/api/auth/session',
    })
    await page.evaluate(() =>
      document.dispatchEvent(new Event('visibilitychange')),
    )
    await unavailableSession
    await page.waitForTimeout(300)
    await choose('Sepia')
    await page
      .getByText(
        'Couldn’t sync. Your choice is kept on this device; we’ll retry.',
        {exact: true},
      )
      .waitFor()
    assert.equal((await state()).cache.pending, true)
    await context.unroute('**/api/**')
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await page
      .getByText('Appearance saved to your account.', {exact: true})
      .waitFor()
    assert.equal((await state()).appearance, 'sepia')
    logs.push({
      step: 'network failure with navigator online',
      appearance: 'sepia',
      pending: false,
    })

    // A real sign-out must clear the remembered owner, unlike a failed check.
    await page.evaluate(async () => {
      const {csrfToken} = await (await fetch('/api/auth/csrf')).json()
      await fetch('/api/auth/signout', {
        method: 'POST',
        headers: {'X-Auth-Return-Redirect': '1'},
        body: new URLSearchParams({csrfToken, callbackUrl: location.href}),
      })
    })
    await page.reload()
    await page
      .getByText('Saved in this browser. Sign in to sync across devices.', {
        exact: true,
      })
      .waitFor()
    await page.waitForFunction(
      () => sessionStorage.getItem('etoN-appearance-session-account') === null,
    )
    await choose('Bookish')
    assert.equal((await state()).appearance, 'bookish')
    assert.equal((await state()).cache.pending, false)
    logs.push({step: 'confirmed sign-out, guest Bookish', pending: false})
    return logs
  } catch (error) {
    throw new Error(
      JSON.stringify({
        message: error.message,
        logs,
        last: await state().catch(() => null),
      }),
      {cause: error},
    )
  } finally {
    await context.setOffline(false)
    await context.unroute('**/api/**')
    try {
      if (original) {
        const {csrfToken} = await (
          await context.request.get(`${baseURL}/api/auth/csrf`)
        ).json()
        await context.request.post(`${baseURL}/api/auth/callback/credentials`, {
          form: {
            csrfToken,
            email: 'qa@test.dev',
            password: 'qa',
            callbackUrl: `${baseURL}/en/settings/appearance`,
          },
        })
        const result = await context.request.put(`${baseURL}${endpoint}`, {
          headers: {Origin: baseURL},
          data: {...original, account: 'qa@test.dev', initialize: false},
        })
        assert.equal(result.status(), 200, 'Restore the original QA preference')
      }
    } finally {
      await context.close()
    }
  }
}
