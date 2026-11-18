import {test, expect} from './fixtures'
import type {Page} from '@playwright/test'
import messages from '../../dictionaries/en.json' with {type: 'json'}
import {
  createReplacementCandidate,
  confirmReplacement,
} from '../../lib/notes/encryption/candidate'
import {decodeRecoveryKey, unwrapRoot} from '../../lib/notes/encryption/crypto'
import type {ConfirmedVault} from '../../lib/notes/encryption/runtime'
const v = messages.note.vault
test.beforeEach(async ({noteApp}) => {
  expect(noteApp.ownerId).toBeTruthy()
})
async function setup(page: Page) {
  await page.goto('/en/collection/encrypted')
  await page.getByRole('button', {name: v.setup, exact: true}).click()
  const phrase = await page.locator('p.font-mono').first().innerText()
  await page.getByRole('button', {name: v.reveal, exact: true}).click()
  const recovery = await page.locator('p.font-mono').last().innerText()
  await page.getByLabel(v.confirmationEntry, {exact: true}).fill(phrase)
  await page.getByRole('button', {name: v.verifyPrimary, exact: true}).click()
  await expect(
    page.getByRole('button', {name: v.primaryVerified, exact: true}),
  ).toBeVisible()
  await page.getByLabel(v.confirmationEntry, {exact: true}).fill(recovery)
  await page.getByRole('button', {name: v.verifyRecovery, exact: true}).click()
  await expect(
    page.getByRole('button', {name: v.recoveryVerified, exact: true}),
  ).toBeVisible()
  await page.getByRole('button', {name: v.activate, exact: true}).click()
  await expect(
    page.getByRole('button', {name: v.replacePassphrase, exact: true}),
  ).toBeVisible()
  return {phrase, recovery}
}
async function prepare(page: Page, recovery: string) {
  await page.getByRole('button', {name: v.useRecovery, exact: true}).click()
  await page.getByLabel(v.recoveryKey, {exact: true}).fill(recovery)
  await page
    .getByRole('button', {name: v.replacePassphrase, exact: true})
    .click()
  await expect(
    page.getByLabel(v.replacementConfirmation, {exact: true}),
  ).toBeVisible()
  return page.locator('p.font-mono').first().innerText()
}
async function intentRows(page: Page) {
  return page.evaluate(
    async () =>
      new Promise<unknown[]>((resolve, reject) => {
        const opening = indexedDB.open('etoN-encrypted-note-recovery')
        opening.onerror = () => reject(opening.error)
        opening.onsuccess = () => {
          const db = opening.result
          const transaction = db.transaction('intents')
          const read = transaction.objectStore('intents').getAll()
          read.onsuccess = () => resolve(read.result)
          read.onerror = () => reject(read.error)
          transaction.oncomplete = () => db.close()
        }
      }),
  )
}
test('recovery replacement survives lost acknowledgement and reports historical receipt after another change', async ({
  page,
}) => {
  test.setTimeout(120000)
  const {phrase, recovery} = await setup(page)
  const original = (await (await page.request.get('/api/note-vault')).json())
    .vault as ConfirmedVault
  const nextPhrase = await prepare(page, recovery)
  await page
    .getByLabel(v.replacementConfirmation, {exact: true})
    .fill('wrong new phrase')
  let patches = 0
  page.on('request', (request) => {
    if (
      request.method() === 'PATCH' &&
      request.url().includes('/api/note-vault')
    )
      patches++
  })
  await page
    .getByRole('button', {name: v.confirmReplacement, exact: true})
    .click()
  await expect(
    page.getByRole('alert').filter({hasText: v.failed}),
  ).toContainText(v.failed)
  expect(patches).toBe(0)
  await page.route('**/api/note-vault', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue()
    expect(await intentRows(page)).toHaveLength(1)
    await route.fetch()
    await route.abort('failed')
  })
  await page
    .getByLabel(v.replacementConfirmation, {exact: true})
    .fill(nextPhrase)
  await page
    .getByRole('button', {name: v.confirmReplacement, exact: true})
    .click()
  await expect(
    page.getByRole('alert').filter({hasText: v.failed}),
  ).toContainText(v.failed)
  const saved = JSON.stringify(await intentRows(page))
  expect(saved).not.toContain(phrase)
  expect(saved).not.toContain(nextPhrase)
  expect(saved).not.toContain(recovery)
  await page.unroute('**/api/note-vault')
  await page.reload()
  await expect(
    page.getByText(v.replacementPending, {exact: true}),
  ).toBeVisible()
  const durable = (await intentRows(page))[0] as {request: unknown}
  await page.route('**/api/note-vault', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue()
    expect(route.request().postDataJSON()).toEqual(durable.request)
    await route.fetch()
    await route.abort('failed')
  })
  await page
    .getByRole('button', {name: v.retryReplacement, exact: true})
    .click()
  await expect(
    page.getByRole('alert').filter({hasText: v.failed}),
  ).toContainText(v.failed)
  await page.unroute('**/api/note-vault')
  // A different client applies a subsequent independently signed change.
  const current = (await (await page.request.get('/api/note-vault')).json())
    .vault as ConfirmedVault
  const recoveryBytes = await decodeRecoveryKey(recovery)
  const raw = await unwrapRoot(current.recoveryWrapper, recoveryBytes)
  recoveryBytes.fill(0)
  try {
    const replacement = await createReplacementCandidate(
      raw,
      {...current, authorization: current.authorization!},
      'passphrase',
    )
    const signed = await confirmReplacement(
      replacement.candidate,
      replacement.passphrase,
    )
    const result = await page.request.patch('/api/note-vault', {
      headers: {
        origin: new URL(page.url()).origin,
        'x-note-encryption-protocol': '1',
      },
      data: signed,
    })
    expect((await result.json()).status).toBe('success')
  } finally {
    raw.fill(0)
  }
  await page.getByRole('button', {name: v.reconcile, exact: true}).click()
  await expect(
    page.getByRole('status').filter({hasText: v.replacementHistorical}),
  ).toBeVisible()
  expect(await intentRows(page)).toHaveLength(0)
  const final = (await (await page.request.get('/api/note-vault')).json())
    .vault as ConfirmedVault
  expect(final.recoveryWrapper).toEqual(original.recoveryWrapper)
  expect(final.authorization).toEqual(original.authorization)
  await page.getByRole('button', {name: v.useRecovery, exact: true}).click()
  await page.getByLabel(v.recoveryKey, {exact: true}).fill(recovery)
  await page.getByRole('button', {name: v.unlock, exact: true}).click()
  await expect(
    page.getByRole('button', {name: v.lock, exact: true}),
  ).toBeVisible()
})

test('primary replacement fails closed when durable browser storage fails', async ({
  page,
}) => {
  test.setTimeout(120000)
  const {phrase} = await setup(page)
  await page.getByLabel(v.passphrase, {exact: true}).fill(phrase)
  await page
    .getByRole('button', {name: v.replacePassphrase, exact: true})
    .click()
  const nextPhrase = await page.locator('p.font-mono').first().innerText()
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'intents')
        throw new DOMException('Simulated quota failure', 'QuotaExceededError')
      return original.apply(this, args)
    }
  })
  let patches = 0
  page.on('request', (request) => {
    if (request.method() === 'PATCH') patches++
  })
  await page
    .getByLabel(v.replacementConfirmation, {exact: true})
    .fill(nextPhrase)
  await page
    .getByRole('button', {name: v.confirmReplacement, exact: true})
    .click()
  await expect(
    page.getByRole('alert').filter({hasText: v.failed}),
  ).toContainText(v.failed)
  expect(patches).toBe(0)
  expect(await intentRows(page)).toHaveLength(0)
  await page.reload()
  await page.getByLabel(v.passphrase, {exact: true}).fill(phrase)
  await page.getByRole('button', {name: v.unlock, exact: true}).click()
  await expect(
    page.getByRole('button', {name: v.lock, exact: true}),
  ).toBeVisible()
})
test('a competing tab cannot overwrite a saved intent or send its different replacement', async ({
  page,
  context,
}) => {
  test.setTimeout(120000)
  const {recovery} = await setup(page)
  const other = await context.newPage()
  try {
    await other.goto('/en/collection/encrypted')
    const firstPhrase = await prepare(page, recovery)
    const otherPhrase = await prepare(other, recovery)
    // Preparing in another page must not erase ciphertext drafts; simulated
    // sibling lock does erase the unsubmitted draft and its revealed phrase.
    let patches = 0
    await page.route('**/api/note-vault', (route) =>
      route.request().method() === 'PATCH'
        ? route.abort('failed')
        : route.continue(),
    )
    await page
      .getByLabel(v.replacementConfirmation, {exact: true})
      .fill(firstPhrase)
    await page
      .getByRole('button', {name: v.confirmReplacement, exact: true})
      .click()
    await expect(
      page.getByRole('alert').filter({hasText: v.failed}),
    ).toContainText(v.failed)
    const before = await intentRows(page)
    other.on('request', (request) => {
      if (request.method() === 'PATCH') patches++
    })
    await other
      .getByLabel(v.replacementConfirmation, {exact: true})
      .fill(otherPhrase)
    await other
      .getByRole('button', {name: v.confirmReplacement, exact: true})
      .click()
    await expect(
      other.getByRole('alert').filter({hasText: v.failed}),
    ).toContainText(v.failed)
    expect(patches).toBe(0)
    expect(await intentRows(other)).toEqual(before)
  } finally {
    await other.close()
  }
})

test('vault invalidation cancels a replacement waiting for the browser write lock', async ({
  page,
}) => {
  test.setTimeout(120000)
  const {recovery} = await setup(page)
  const phrase = await prepare(page, recovery)
  const vault = (await (await page.request.get('/api/note-vault')).json())
    .vault as ConfirmedVault
  const lockName = `eton-note-writes:${vault.ownerId}`
  await page.evaluate(async (name) => {
    await new Promise<void>((acquired) => {
      void navigator.locks.request(
        name,
        () =>
          new Promise<void>((release) => {
            window.addEventListener(
              'release-test-write-lock',
              () => release(),
              {once: true},
            )
            acquired()
          }),
      )
    })
  }, lockName)
  let patches = 0
  page.on('request', (request) => {
    if (request.method() === 'PATCH') patches++
  })
  await page.getByLabel(v.replacementConfirmation, {exact: true}).fill(phrase)
  await page
    .getByRole('button', {name: v.confirmReplacement, exact: true})
    .click()
  await expect
    .poll(() =>
      page.evaluate(
        async (name) =>
          (await navigator.locks.query()).pending?.some(
            (lock) => lock.name === name,
          ),
        lockName,
      ),
    )
    .toBe(true)
  await page.evaluate((ownerId) => {
    window.dispatchEvent(
      new CustomEvent('eton-vault-invalidated', {detail: ownerId}),
    )
    window.dispatchEvent(new Event('release-test-write-lock'))
  }, vault.ownerId)
  await expect(
    page.getByRole('alert').filter({hasText: v.failed}),
  ).toContainText(v.failed)
  expect(patches).toBe(0)
  expect(await intentRows(page)).toHaveLength(0)
  await expect(
    page.getByLabel(v.replacementConfirmation, {exact: true}),
  ).toHaveCount(0)
})
