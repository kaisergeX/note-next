import {test, expect} from './fixtures'
import messages from '../../dictionaries/en.json' with {type: 'json'}
const v = messages.note.vault
test('virtual authenticator PRF enrollment, relock, recovery replacement and cancellation fail closed', async ({
  page,
  context,
  noteApp,
}) => {
  test.setTimeout(180000)
  const session = await context.newCDPSession(page)
  await session.send('WebAuthn.enable')
  const {authenticatorId} = await session.send(
    'WebAuthn.addVirtualAuthenticator',
    {
      options: {
        protocol: 'ctap2',
        ctap2Version: 'ctap2_1',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
        hasPrf: true,
      },
    },
  )
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' || request.method() === 'PATCH')
      requests.push(request.postData() ?? '')
  })
  try {
    await page.goto('/en/collection/encrypted')
    await page.getByRole('button', {name: v.setupPasskey, exact: true}).click()
    await expect(
      page.getByRole('button', {name: v.verifyPrimary, exact: true}),
    ).toBeVisible()
    await page.getByRole('button', {name: v.reveal, exact: true}).click()
    const kit = await page.locator('p.font-mono').last().innerText()
    await page.getByRole('button', {name: v.verifyPrimary, exact: true}).click()
    await expect(
      page.getByRole('button', {name: v.primaryVerified, exact: true}),
    ).toBeVisible()
    await page.getByLabel(v.confirmationEntry, {exact: true}).fill(kit)
    await page
      .getByRole('button', {name: v.verifyRecovery, exact: true})
      .click()
    await expect(
      page.getByRole('button', {name: v.recoveryVerified, exact: true}),
    ).toBeVisible()
    await page.getByRole('button', {name: v.activate, exact: true}).click()
    await expect(
      page.getByRole('button', {name: v.unlock, exact: true}),
    ).toBeVisible()
    await expect(page.getByLabel(v.passphrase, {exact: true})).not.toBeVisible()
    await page.getByRole('button', {name: v.unlock, exact: true}).click()
    await expect(
      page.getByRole('button', {name: v.lock, exact: true}),
    ).toBeVisible()
    await page.getByRole('button', {name: v.lock, exact: true}).click()
    await page.getByRole('button', {name: v.unlock, exact: true}).click()
    await expect(
      page.getByRole('button', {name: v.lock, exact: true}),
    ).toBeVisible()
    await page.getByRole('button', {name: v.lock, exact: true}).click()
    await page.getByRole('button', {name: v.useRecovery, exact: true}).click()
    await expect(
      page.getByRole('button', {name: v.usePasskey, exact: true}),
    ).toBeVisible()
    await page.getByLabel(v.recoveryKey, {exact: true}).fill(kit)
    await page.getByRole('button', {name: v.changePasskey, exact: true}).click()
    await expect(
      page.getByRole('button', {name: v.confirmChange, exact: true}),
    ).toBeVisible()
    await expect(
      page.getByText(v.verifyNewPasskey, {exact: true}),
    ).toBeVisible()
    await expect(page.getByLabel(v.confirmNew, {exact: true})).not.toBeVisible()
    // Commit the replacement, then lose its acknowledgement. Only the exact
    // sealed operation is retained, and a reload must reconcile server state.
    await page.route('**/api/note-vault', async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue()
      expect((await route.fetch()).ok()).toBe(true)
      await route.abort('failed')
    })
    const committed = page.waitForRequest(
      (request) =>
        request.method() === 'PATCH' &&
        new URL(request.url()).pathname === '/api/note-vault',
    )
    await page.getByRole('button', {name: v.confirmChange, exact: true}).click()
    await committed
    await expect(
      page.getByRole('alert').filter({hasText: v.failed}),
    ).toBeVisible()
    await page.unroute('**/api/note-vault')
    await page.reload()
    await page.getByRole('button', {name: v.reconcile, exact: true}).click()
    await expect(
      page.getByRole('status').filter({hasText: v.reconciled}),
    ).toBeVisible()
    await page.getByRole('button', {name: v.unlock, exact: true}).click()
    await expect(
      page.getByRole('button', {name: v.lock, exact: true}),
    ).toBeVisible()
    const all = requests.join('\n')
    expect(all).not.toContain(kit)
    expect(all).not.toContain('"prf"')
    expect(all).not.toContain('"results"')
    expect(all).not.toContain('"first"')
    await page.getByRole('button', {name: v.lock, exact: true}).click()
    await page.evaluate(() => {
      navigator.credentials.get = async () => {
        throw new DOMException('Cancelled', 'NotAllowedError')
      }
    })
    await page.getByRole('button', {name: v.unlock, exact: true}).click()
    await expect(
      page.getByRole('alert').filter({hasText: v.failed}),
    ).toBeVisible()
    await expect(
      page.getByRole('button', {name: v.lock, exact: true}),
    ).not.toBeVisible()
    expect(noteApp.ownerId).toBeTruthy()
  } finally {
    await session.send('WebAuthn.removeVirtualAuthenticator', {authenticatorId})
    await session.detach()
  }
})

test('missing authenticator PRF cannot activate a vault and offers generated passphrase fallback', async ({
  page,
  context,
  noteApp,
}) => {
  const session = await context.newCDPSession(page)
  await session.send('WebAuthn.enable')
  const {authenticatorId} = await session.send(
    'WebAuthn.addVirtualAuthenticator',
    {
      options: {
        protocol: 'ctap2',
        ctap2Version: 'ctap2_1',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
        hasPrf: false,
      },
    },
  )
  try {
    await page.goto('/en/collection/encrypted')
    await page.getByRole('button', {name: v.setupPasskey, exact: true}).click()
    await expect(
      page.getByRole('alert').filter({hasText: v.failed}),
    ).toBeVisible()
    await expect(
      page.getByRole('button', {name: v.activate, exact: true}),
    ).not.toBeVisible()
    const before = await page.request.get('/api/note-vault')
    expect((await before.json()).vault).toBeNull()
    await page.getByRole('button', {name: v.setup, exact: true}).click()
    const phrase = await page.locator('p.font-mono').first().innerText()
    await page.getByRole('button', {name: v.reveal, exact: true}).click()
    const kit = await page.locator('p.font-mono').last().innerText()
    await page.getByLabel(v.confirmationEntry, {exact: true}).fill(phrase)
    // A sibling-tab lock also clears revealed provisional setup material.
    await page.evaluate((ownerId) => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'eton-vault-lock',
          newValue: JSON.stringify([ownerId, crypto.randomUUID()]),
        }),
      )
    }, noteApp.ownerId)
    await expect(
      page.getByLabel(v.confirmationEntry, {exact: true}),
    ).toHaveValue('')
    await expect(page.getByText(phrase, {exact: true})).not.toBeVisible()
    await expect(page.getByText(kit, {exact: true})).not.toBeVisible()
    await page.getByLabel(v.confirmationEntry, {exact: true}).fill(phrase)
    await page.getByRole('button', {name: v.verifyPrimary, exact: true}).click()
    await expect(
      page.getByRole('button', {name: v.primaryVerified, exact: true}),
    ).toBeVisible()
    await page.getByLabel(v.confirmationEntry, {exact: true}).fill(kit)
    await page
      .getByRole('button', {name: v.verifyRecovery, exact: true})
      .click()
    await expect(
      page.getByRole('button', {name: v.recoveryVerified, exact: true}),
    ).toBeVisible()
    await page.getByRole('button', {name: v.activate, exact: true}).click()
    await page.getByLabel(v.passphrase, {exact: true}).fill(phrase)
    await page.getByRole('button', {name: v.unlock, exact: true}).click()
    await expect(
      page.getByRole('button', {name: v.lock, exact: true}),
    ).toBeVisible()
    const after = await page.request.get('/api/note-vault')
    expect((await after.json()).vault.primaryWrapper.purpose).toBe('passphrase')
    expect(noteApp.ownerId).toBeTruthy()
  } finally {
    await session.send('WebAuthn.removeVirtualAuthenticator', {authenticatorId})
    await session.detach()
  }
})
