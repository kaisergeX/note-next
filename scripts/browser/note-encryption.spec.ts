import {randomUUID} from 'node:crypto'
import {test, expect} from './fixtures'
import messages from '../../dictionaries/en.json' with {type: 'json'}

const vault = messages.note.vault
const editor = messages.note.encryptedEditor
const encrypted = messages.note.encryption

test('encrypted setup, ciphertext persistence, tab locking and fresh-tab recovery', async ({
  page,
  context,
  noteApp,
}) => {
  test.setTimeout(120_000)
  await page.goto('/en/collection/encrypted')
  await page.getByRole('button', {name: vault.setup, exact: true}).click()
  const phrase = await page.locator('p.font-mono').first().innerText()
  await page.getByRole('button', {name: vault.reveal, exact: true}).click()
  const recovery = await page.locator('p.font-mono').nth(1).innerText()
  expect(phrase.length).toBeGreaterThan(20)
  expect(recovery).toMatch(/^eton/)
  await page.getByLabel(vault.confirmationEntry, {exact: true}).fill(phrase)
  await page
    .getByRole('button', {name: vault.verifyPrimary, exact: true})
    .click()
  await expect(
    page.getByRole('button', {name: vault.primaryVerified, exact: true}),
  ).toBeVisible()
  await page.getByLabel(vault.confirmationEntry, {exact: true}).fill(recovery)
  await page
    .getByRole('button', {name: vault.verifyRecovery, exact: true})
    .click()
  await expect(
    page.getByRole('button', {name: vault.recoveryVerified, exact: true}),
  ).toBeVisible()
  await page.getByRole('button', {name: vault.activate, exact: true}).click()
  await page.getByLabel(vault.passphrase, {exact: true}).fill(phrase)
  await page.getByRole('button', {name: vault.unlock, exact: true}).click()
  await page.getByRole('button', {name: encrypted.create, exact: true}).click()
  const sentinel = `E2EE-SENTINEL-${randomUUID()}`
  const title = page.getByRole('textbox', {name: editor.title, exact: true})
  const body = page.getByRole('textbox', {name: editor.body, exact: true})
  await expect(body).toBeVisible()
  await title.fill(sentinel)
  await body.fill(`Private body ${sentinel}`)
  const sent = page.waitForRequest(
    (request) =>
      request.method() === 'PUT' &&
      request.url().includes('/api/note-encryption/'),
  )
  await page.getByRole('button', {name: editor.save, exact: true}).click()
  const request = await sent
  expect(request.postData()).not.toContain(sentinel)
  expect(request.postData()).not.toContain(phrase)
  expect(request.postData()).not.toContain(recovery)
  await expect(
    page.getByRole('status').filter({hasText: editor.synced}),
  ).toBeVisible()
  const noteId = new URL(request.url()).pathname.split('/').at(-1)!
  const stored = await page.evaluate(async () => {
    const output: unknown[] = []
    for (const {name} of await indexedDB.databases()) {
      if (!name?.startsWith('etoN-')) continue
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(name)
        open.onsuccess = () => resolve(open.result)
        open.onerror = () => reject(open.error)
      })
      for (const store of database.objectStoreNames) {
        output.push(
          await new Promise((resolve, reject) => {
            const read = database.transaction(store).objectStore(store).getAll()
            read.onsuccess = () => resolve(read.result)
            read.onerror = () => reject(read.error)
          }),
        )
      }
      database.close()
    }
    return JSON.stringify([output, {...localStorage}, {...sessionStorage}])
  })
  expect(stored).not.toContain(sentinel)
  expect(stored).not.toContain(phrase)
  expect(stored).not.toContain(recovery)
  expect((await noteApp.read(noteId)).title).toBeNull()
  expect((await noteApp.read(noteId)).content).toBeNull()
  await page.getByRole('button', {name: vault.lock, exact: true}).click()
  await expect(body).not.toBeVisible()
  await expect(page.getByText(sentinel, {exact: true})).not.toBeVisible()
  const fresh = await context.newPage()
  try {
    await fresh.goto('/en/collection/encrypted')
    await expect(
      fresh.getByRole('button', {name: encrypted.create, exact: true}),
    ).not.toBeVisible()
    await fresh
      .getByRole('button', {name: vault.useRecovery, exact: true})
      .click()
    await fresh.getByLabel(vault.recoveryKey, {exact: true}).fill(recovery)
    await fresh.getByRole('button', {name: vault.unlock, exact: true}).click()
    await fresh.getByRole('button', {name: sentinel, exact: true}).click()
    await expect(
      fresh.getByRole('textbox', {name: editor.body, exact: true}),
    ).toContainText(sentinel)
  } finally {
    await fresh.close()
  }
})

