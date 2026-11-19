import {test, expect} from './fixtures'
import type {BrowserContext, Page} from '@playwright/test'
import postgres from 'postgres'
import type {SignedReplacement} from '../../lib/notes/encryption/authorization'
import messages from '../../dictionaries/en.json' with {type: 'json'}
import type {ConfirmedVault} from '../../lib/notes/encryption/runtime'
const v = messages.note.vault
function closedEnrollmentOrigin() {
  const origin = new URL(process.env.NOTES_CLOSED_ENROLLMENT_ORIGIN!)
  expect(origin.protocol).toBe('http:')
  expect(origin.hostname).toBe(new URL(process.env.NOTES_TEST_ORIGIN!).hostname)
  return origin.origin
}
const registrationRequests = (vaultId: string) => [
  {operation: 'register-options', vaultId},
  {
    operation: 'register-verify',
    ceremonyId: crypto.randomUUID(),
    response: {
      id: 'AA',
      rawId: 'AA',
      type: 'public-key',
      clientExtensionResults: {},
      response: {clientDataJSON: 'AA', attestationObject: 'AA'},
    },
  },
]
// Use a local preview sharing the fixture DB/auth secret with BOTH enrollment
// and creation flags disabled. The stress suite's creation-only origin is separate.
test('closed enrollment and creation refuse new-account registration and replacement', async ({
  page,
  noteApp,
}) => {
  test.skip(
    !process.env.NOTES_CLOSED_ENROLLMENT_ORIGIN,
    'Set NOTES_CLOSED_ENROLLMENT_ORIGIN to a preview with both NOTE_ENCRYPTION_ENROLLMENT_ENABLED and NOTE_ENCRYPTION_CREATION_ENABLED false.',
  )
  const origin = closedEnrollmentOrigin()
  const headers = {origin, 'x-note-encryption-protocol': '1'}
  const before = await page.request.get(`${origin}/api/note-vault`)
  expect(before.ok()).toBe(true)
  expect((await before.json()).vault).toBeNull()
  for (const data of registrationRequests(crypto.randomUUID())) {
    const response = await page.request.post(
      `${origin}/api/note-vault/passkey`,
      {
        headers,
        data,
      },
    )
    expect(response.ok()).toBe(true)
    expect(await response.json()).toEqual({status: 'disabled'})
  }
  const replacement = await page.request.patch(`${origin}/api/note-vault`, {
    headers,
    data: {},
  })
  expect(replacement.status()).toBe(200)
  expect(await replacement.json()).toEqual({status: 'invalid_input'})
  const after = await page.request.get(`${origin}/api/note-vault`)
  expect(after.ok()).toBe(true)
  expect((await after.json()).vault).toBeNull()
  expect(noteApp.ownerId).toBeTruthy()
})

async function virtualAuthenticator(context: BrowserContext, page: Page) {
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
  return {session, authenticatorId}
}

async function enroll(page: Page) {
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
  await page.getByRole('button', {name: v.verifyRecovery, exact: true}).click()
  await expect(
    page.getByRole('button', {name: v.recoveryVerified, exact: true}),
  ).toBeVisible()
  await page.getByRole('button', {name: v.activate, exact: true}).click()
  return kit
}

test('virtual authenticator PRF enrollment, signed replacement, reconciliation and cancellation', async ({
  page,
  context,
  noteApp,
}) => {
  test.setTimeout(180000)
  const {session, authenticatorId} = await virtualAuthenticator(context, page)
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' || request.method() === 'PATCH')
      requests.push(request.postData() ?? '')
  })
  try {
    const kit = await enroll(page)
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
    await page.getByRole('button', {name: v.unlock, exact: true}).click()
    await expect(
      page.getByRole('button', {name: v.lock, exact: true}),
    ).toBeVisible()
    await page.getByRole('button', {name: v.lock, exact: true}).click()
    await page.reload()
    const before = await page.request.get('/api/note-vault')
    expect(before.ok()).toBe(true)
    const {vault} = (await before.json()) as {vault: ConfirmedVault}
    // Send the unchanged sealed wrapper through the real guarded route.
    const refused = await page.request.patch('/api/note-vault', {
      headers: {
        origin: new URL(page.url()).origin,
        'x-note-encryption-protocol': '1',
      },
      data: {
        operationId: crypto.randomUUID(),
        expectedRevision: vault.revision,
        primaryWrapper: vault.primaryWrapper,
      },
    })
    expect(refused.status()).toBe(200)
    expect(await refused.json()).toEqual({status: 'invalid_input'})
    const unchanged = await page.request.get('/api/note-vault')
    expect(unchanged.ok()).toBe(true)
    expect((await unchanged.json()).vault).toEqual(vault)
    // Existing authorization-v1 vaults may enroll replacement credentials;
    // a ceremony for a different vault and an invented ceremony remain invalid.
    for (const data of registrationRequests(crypto.randomUUID())) {
      const registration = await page.request.post('/api/note-vault/passkey', {
        headers: {
          origin: new URL(page.url()).origin,
          'x-note-encryption-protocol': '1',
        },
        data,
      })
      expect(registration.ok()).toBe(true)
      expect(await registration.json()).toEqual({status: 'invalid_input'})
    }

    let browserPatches = 0
    page.on('request', (request) => {
      if (
        request.method() === 'PATCH' &&
        new URL(request.url()).pathname === '/api/note-vault'
      )
        browserPatches++
    })
    const historicalCases = [
      {
        operationId: crypto.randomUUID(),
        primaryWrapper: vault.primaryWrapper,
        active: false,
      },
      {
        operationId: vault.lastOperationId,
        primaryWrapper: {
          ...vault.primaryWrapper,
          wrapperId: crypto.randomUUID(),
        },
        active: false,
      },
      {
        operationId: vault.lastOperationId,
        primaryWrapper: vault.primaryWrapper,
        active: true,
      },
    ]
    for (const historical of historicalCases) {
      // Synthetic preupgrade local state uses existing ciphertext only.
      await page.evaluate(
        ({ownerId, vault, historical}) => {
          sessionStorage.setItem(
            `eton-provisional-vault:${ownerId}:replacement`,
            JSON.stringify({
              operationId: historical.operationId,
              expectedRevision: vault.revision,
              primaryWrapper: historical.primaryWrapper,
              submitted: true,
            }),
          )
        },
        {ownerId: noteApp.ownerId, vault, historical},
      )
      await page.reload()
      // Old pending state cannot block the authoritative passkey.
      await page.getByRole('button', {name: v.unlock, exact: true}).click()
      await expect(
        page.getByRole('button', {name: v.lock, exact: true}),
      ).toBeVisible()
      await page.getByRole('button', {name: v.lock, exact: true}).click()
      if (historical.active) {
        await page.route('**/api/note-vault', (route) => route.abort('failed'))
        await page.getByRole('button', {name: v.reconcile, exact: true}).click()
        await expect(
          page.getByRole('alert').filter({hasText: v.failed}),
        ).toBeVisible()
        await expect(
          page.getByText(v.replacementCheck, {exact: true}),
        ).toBeVisible()
        await page.unroute('**/api/note-vault')
      }
      await page.getByRole('button', {name: v.reconcile, exact: true}).click()
      await expect(
        page.getByRole('status').filter({
          hasText: historical.active
            ? v.replacementActive
            : v.replacementInactive,
        }),
      ).toBeVisible()
      expect(
        await page.evaluate(
          (ownerId) =>
            sessionStorage.getItem(
              `eton-provisional-vault:${ownerId}:replacement`,
            ),
          noteApp.ownerId,
        ),
      ).toBeNull()
      expect(browserPatches).toBe(0)
    }
    if (process.env.NOTES_CLOSED_ENROLLMENT_ORIGIN) {
      // The same authenticator must still open the vault after enrollment closes.
      await page.goto(closedEnrollmentOrigin() + '/en/collection/encrypted')
    }
    const replacementOptions = await page.request.post(
      new URL('/api/note-vault/passkey', page.url()).href,
      {
        headers: {
          origin: new URL(page.url()).origin,
          'x-note-encryption-protocol': '1',
        },
        data: {operation: 'register-options', vaultId: vault.id},
      },
    )
    expect(replacementOptions.ok()).toBe(true)
    expect(await replacementOptions.json()).toMatchObject({status: 'success'})
    await page.getByRole('button', {name: v.unlock, exact: true}).click()
    await expect(
      page.getByRole('button', {name: v.lock, exact: true}),
    ).toBeVisible()
    await page
      .getByRole('button', {name: v.replacePasskey, exact: true})
      .click()
    await expect(
      page.getByRole('button', {name: v.confirmReplacement, exact: true}),
    ).toBeFocused()
    await page
      .getByRole('button', {name: v.cancelReplacement, exact: true})
      .click()
    expect(browserPatches).toBe(0)
    await page.getByRole('button', {name: v.lock, exact: true}).click()
    await page.getByRole('button', {name: v.unlock, exact: true}).click()
    await expect(
      page.getByRole('button', {name: v.lock, exact: true}),
    ).toBeVisible()
    await page.getByRole('button', {name: v.lock, exact: true}).click()
    await page.getByRole('button', {name: v.useRecovery, exact: true}).click()
    await page.getByLabel(v.recoveryKey, {exact: true}).fill(kit)
    await page
      .getByRole('button', {name: v.replacePasskey, exact: true})
      .click()
    const confirm = page.getByRole('button', {
      name: v.confirmReplacement,
      exact: true,
    })
    await expect(confirm).toBeFocused()
    const [patch] = await Promise.all([
      page.waitForRequest(
        (request) =>
          request.method() === 'PATCH' &&
          new URL(request.url()).pathname === '/api/note-vault',
      ),
      page.keyboard.press('Enter'),
    ])
    await expect(
      page.getByRole('status').filter({hasText: v.replacementChanged}),
    ).toBeVisible()
    await expect(
      page.getByRole('button', {name: v.unlock, exact: true}),
    ).toBeFocused()
    const signed = patch.postDataJSON()
    expect(signed).toMatchObject({
      expectedRevision: vault.revision,
      signature: expect.any(String),
      primaryWrapper: {purpose: 'passkey'},
    })
    const operation = await page.request.get(
      new URL(`/api/note-vault?operationId=${signed.operationId}`, page.url())
        .href,
    )
    const {vault: replaced, receipt} = await operation.json()
    expect(receipt).toMatchObject({
      operationId: signed.operationId,
      appliedRevision: replaced.revision,
    })
    expect(replaced.revision).not.toBe(vault.revision)
    expect(replaced.primaryWrapper).toEqual(signed.primaryWrapper)
    expect(replaced.primaryWrapper.passkeyBinding[1]).not.toBe(
      vault.primaryWrapper.passkeyBinding![1],
    )
    expect(replaced.recoveryWrapper).toEqual(vault.recoveryWrapper)
    expect(replaced.authorization).toEqual(vault.authorization)
    const oldCredential = await page.request.post(
      new URL('/api/note-vault/passkey', page.url()).href,
      {
        headers: {
          origin: new URL(page.url()).origin,
          'x-note-encryption-protocol': '1',
        },
        data: {
          operation: 'assertion-options',
          vaultId: vault.id,
          credentialId: vault.primaryWrapper.passkeyBinding![1],
        },
      },
    )
    expect(await oldCredential.json()).toMatchObject({status: 'success'})
    await page.reload()
    await page.getByRole('button', {name: v.unlock, exact: true}).click()
    await expect(
      page.getByRole('button', {name: v.lock, exact: true}),
    ).toBeVisible()
    expect(browserPatches).toBe(1)
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

for (const committed of [false, true]) {
  test(`retry with an expired passkey assertion when replacement ${committed ? 'has a receipt' : 'did not commit'}`, async ({
    page,
    context,
    noteApp,
  }) => {
    const {session, authenticatorId} = await virtualAuthenticator(context, page)
    const sql = postgres(process.env.DATABASE_URL!, {max: 1})
    try {
      const kit = await enroll(page)
      await page.getByRole('button', {name: v.useRecovery, exact: true}).click()
      await page.getByLabel(v.recoveryKey, {exact: true}).fill(kit)
      await page
        .getByRole('button', {name: v.replacePasskey, exact: true})
        .click()
      let signed: SignedReplacement | undefined
      await page.route('**/api/note-vault', async (route) => {
        if (route.request().method() !== 'PATCH') return route.continue()
        signed = route.request().postDataJSON()
        if (committed) {
          const response = await route.fetch()
          expect((await response.json()).status).toBe('success')
        }
        await route.abort('failed')
      })
      await page
        .getByRole('button', {name: v.confirmReplacement, exact: true})
        .click()
      await expect(
        page.getByRole('alert').filter({hasText: v.failed}),
      ).toBeVisible()
      await page.unroute('**/api/note-vault')
      expect(signed).toBeDefined()
      const credentialId = signed!.primaryWrapper.passkeyBinding![1]
      const expired = await sql`
        update note_passkeys set verified_at = now() - interval '11 minutes'
        where owner_id = ${noteApp.ownerId} and credential_id = ${credentialId}
      `
      expect(expired.count).toBe(1)
      await page.reload()
      const assertions: string[] = []
      const patches: unknown[] = []
      page.on('request', (request) => {
        const path = new URL(request.url()).pathname
        if (path === '/api/note-vault' && request.method() === 'PATCH')
          patches.push(request.postDataJSON())
        if (path === '/api/note-vault/passkey' && request.method() === 'POST') {
          const data = request.postDataJSON()
          if (data.operation === 'assertion-options')
            assertions.push(data.credentialId)
        }
      })
      await page
        .getByRole('button', {name: v.retryReplacement, exact: true})
        .click()
      await expect(
        page.getByText(v.replacementActive, {exact: true}),
      ).toBeVisible()
      expect(assertions).toEqual(committed ? [] : [credentialId])
      expect(patches).toEqual(committed ? [signed] : [signed, signed])
      await page.getByRole('button', {name: v.unlock, exact: true}).click()
      await expect(
        page.getByRole('button', {name: v.lock, exact: true}),
      ).toBeVisible()
    } finally {
      await sql.end()
      await session.send('WebAuthn.removeVirtualAuthenticator', {
        authenticatorId,
      })
      await session.detach()
    }
  })
}

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
