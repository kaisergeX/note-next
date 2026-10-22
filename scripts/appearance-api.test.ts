import assert from 'node:assert/strict'
import {test} from 'node:test'

const origin = process.env.APPEARANCE_TEST_ORIGIN

test(
  'appearance routes and API enforce guest/account boundaries',
  {skip: !origin},
  async () => {
    const base = origin!
    const account = 'qa@test.dev'
    const endpoint = `${base}/api/user/appearance?${new URLSearchParams({account})}`
    const guest = await fetch(`${base}/en/settings/appearance`)
    assert.equal(guest.status, 200)
    const settings = await fetch(`${base}/en/settings`, {redirect: 'manual'})
    assert.ok(
      settings.status === 307
        ? /\/en\/settings\/appearance$/.test(
            settings.headers.get('location') ?? '',
          )
        : (await settings.text()).includes('/en/settings/appearance'),
    )
    const protectedAccount = await fetch(`${base}/en/settings/account`, {
      redirect: 'manual',
    })
    // The account page can stream its redirect after the public parent has rendered.
    assert.ok(
      protectedAccount.status === 307 ||
        (await protectedAccount.text()).includes('/en/login'),
    )
    assert.equal((await fetch(endpoint)).status, 401)
    assert.equal((await fetch(endpoint, {method: 'PUT'})).status, 401)

    // Use a separate QA session; never touch the browser's session or create users.
    const cookies = new Map<string, string>()
    const receiveCookies = (response: Response) => {
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(';', 1)[0]
        const index = pair.indexOf('=')
        cookies.set(pair.slice(0, index), pair.slice(index + 1))
      }
    }
    const cookieHeader = () =>
      Array.from(cookies, ([key, value]) => `${key}=${value}`).join('; ')
    const csrf = await fetch(`${base}/api/auth/csrf`)
    receiveCookies(csrf)
    const {csrfToken} = await csrf.json()
    const login = await fetch(`${base}/api/auth/callback/credentials`, {
      method: 'POST',
      redirect: 'manual',
      headers: {Cookie: cookieHeader()},
      body: new URLSearchParams({
        csrfToken,
        email: account,
        password: 'qa',
        callbackUrl: `${base}/en/settings/appearance`,
      }),
    })
    receiveCookies(login)
    const headers = {
      Cookie: cookieHeader(),
      Origin: base,
      'Content-Type': 'application/json',
    }
    const loaded = await fetch(endpoint, {headers})
    assert.equal(
      loaded.status,
      200,
      'Provision the existing qa@test.dev user before running this test',
    )
    assert.match(loaded.headers.get('cache-control') ?? '', /private.*no-store/)
    const original = await loaded.json()
    assert.equal(original.account, account)
    const payload = {
      account,
      appearance: 'sepia',
      mode: 'dark',
      initialize: false,
    }
    const put = (body: unknown, originHeader = base) =>
      fetch(endpoint, {
        method: 'PUT',
        headers: {...headers, Origin: originHeader},
        body: JSON.stringify(body),
      })
    assert.equal((await put(payload, 'https://other.example')).status, 403)
    assert.equal((await put({...payload, appearance: 'invalid'})).status, 400)
    assert.equal((await put({...payload, mode: 'invalid'})).status, 400)
    assert.equal(
      (await put({...payload, account: 'another@example.com'})).status,
      409,
    )
    assert.equal(
      (
        await fetch(`${base}/api/user/appearance?account=another@example.com`, {
          headers,
        })
      ).status,
      409,
    )
    if (original.preference) {
      const initialize = await put({...payload, initialize: true})
      assert.equal(initialize.status, 200)
      assert.deepEqual(
        (await initialize.json()).preference,
        original.preference,
        'Initialization must not overwrite an existing preference',
      )
    }
  },
)
