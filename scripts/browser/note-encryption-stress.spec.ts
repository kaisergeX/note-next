import {randomUUID} from 'node:crypto'
import type {Page} from '@playwright/test'
import {test, expect} from './fixtures'
import {
  generateRoot,
  generatePassphraseSalt,
  wrapRoot,
  importRoot,
  openRecovery,
  sealRecovery,
  sealNote,
} from '../../lib/notes/encryption/crypto'
import {prepareEncryptedWrite} from '../../lib/notes/encryption/sync'
import {
  recoveryRouteFromHeader,
  type RecoveryHeader,
} from '../../lib/notes/encryption/storage'
import {validateRecoveryPayload} from '../../lib/notes/encryption/recovery'
import type {SealedEnvelope} from '../../lib/notes/encryption/protocol'
import {PASSPHRASE_PROFILE} from '../../lib/notes/encryption/protocol'
import messages from '../../dictionaries/en.json' with {type: 'json'}

const v = messages.note.vault,
  e = messages.note.encryptedEditor
async function enroll(page: Page, ownerId: string) {
  const raw = generateRoot(),
    vaultId = randomUUID(),
    phrase = `Synthetic browser stress ${randomUUID()}`
  const common = {ownerId, vaultId, passkeyBinding: null}
  const primaryWrapper = await wrapRoot(
    raw,
    {
      ...common,
      wrapperId: randomUUID(),
      purpose: 'passphrase',
      profileId: PASSPHRASE_PROFILE,
      salt: generatePassphraseSalt(),
    },
    phrase,
  )
  const recoveryWrapper = await wrapRoot(
    raw,
    {
      ...common,
      wrapperId: randomUUID(),
      purpose: 'recovery',
      profileId: null,
      salt: null,
    },
    generateRoot(),
  )
  const root = await importRoot(raw)
  raw.fill(0)
  await page.goto('/en/collection/encrypted')
  await expect(
    page.getByRole('button', {name: v.setup, exact: true}),
  ).toBeVisible()
  const result = await page.evaluate(
    async (body) => {
      const response = await fetch('/api/note-vault', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-note-encryption-protocol': '1',
        },
        body: JSON.stringify(body),
      })
      return response.json()
    },
    {setupId: randomUUID(), vaultId, primaryWrapper, recoveryWrapper},
  )
  expect(result.status).toBe('success')
  await page.reload()
  await page.getByLabel(v.passphrase, {exact: true}).fill(phrase)
  await page.getByRole('button', {name: v.unlock, exact: true}).click()
  await page
    .getByRole('button', {name: messages.note.encryption.create, exact: true})
    .click()
  await expect(
    page.getByRole('textbox', {name: e.body, exact: true}),
  ).toBeVisible()
  return {phrase, root}
}

test('a different tab checkpoint cannot be overwritten by a larger local edit counter', async ({
  page,
  noteApp,
}) => {
  const {root} = await enroll(page, noteApp.ownerId)
  const body = page.getByRole('textbox', {name: e.body, exact: true})
  await body.fill('Common baseline')
  await page.getByRole('button', {name: e.save, exact: true}).click()
  await expect(
    page.getByRole('status').filter({hasText: e.synced}),
  ).toBeVisible()
  const pair = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('etoN-encrypted-note-recovery')
      request.onsuccess = () => resolve(request.result)
    })
    const transaction = database.transaction(['headers', 'payloads'])
    const read = <T>(store: string) =>
      new Promise<T>((resolve) => {
        const request = transaction.objectStore(store).getAll()
        request.onsuccess = () => resolve(request.result[0])
      })
    const [header, payload] = await Promise.all([
      read<RecoveryHeader>('headers'),
      read<{envelope: SealedEnvelope}>('payloads'),
    ])
    database.close()
    return {header, envelope: payload.envelope}
  })
  const route = recoveryRouteFromHeader(pair.header)
  const competing = validateRecoveryPayload(
    await openRecovery(root, route, pair.envelope),
    route,
  )
  competing.route.generation++
  competing.draft.content = '<p>Other tab retained work</p>'
  const envelope = await sealRecovery(root, competing.route, competing)
  await page.evaluate(
    async ({header, envelope}) => {
      const database = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open('etoN-encrypted-note-recovery')
        request.onsuccess = () => resolve(request.result)
      })
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(
          ['headers', 'payloads'],
          'readwrite',
        )
        transaction.objectStore('headers').put(header)
        transaction
          .objectStore('payloads')
          .put({id: header.id, ownerId: header.ownerId, envelope})
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
      database.close()
    },
    {
      header: {
        ...pair.header,
        generation: competing.route.generation,
        status: 'local' as const,
      },
      envelope,
    },
  )
  for (let index = 0; index < 5; index++)
    await body.fill(`Current tab work ${index}`)
  await page.getByRole('button', {name: e.save, exact: true}).click()
  await expect(
    page.getByRole('alert').filter({hasText: e.failure}),
  ).toBeVisible()
  const headers = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('etoN-encrypted-note-recovery')
      request.onsuccess = () => resolve(request.result)
    })
    const rows = await new Promise<RecoveryHeader[]>((resolve) => {
      const request = database
        .transaction('headers')
        .objectStore('headers')
        .getAll()
      request.onsuccess = () => resolve(request.result)
    })
    database.close()
    return rows
  })
  expect(
    headers.find((header) => header.id === pair.header.id)?.generation,
  ).toBe(competing.route.generation)
  expect(
    headers.some(
      (header) => header.status === 'retained' && header.id !== pair.header.id,
    ),
  ).toBe(true)
})

test('reopen refreshes clean work and preserves conflict revision across reload', async ({
  page,
  noteApp,
}) => {
  test.setTimeout(90_000)
  const {root, phrase} = await enroll(page, noteApp.ownerId)
  const body = page.getByRole('textbox', {name: e.body, exact: true})
  await body.fill('Initial baseline')
  const firstSaved = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().includes('/api/note-encryption/'),
  )
  await page.getByRole('button', {name: e.save, exact: true}).click()
  const first = await (await firstSaved).json()
  await expect(
    page.getByRole('status').filter({hasText: e.synced}),
  ).toBeVisible()
  const {
    id: noteId,
    encryptedPayload: {vaultId},
  } = first.note
  const remoteWrite = async (revision: string, content: string) => {
    const payload = await sealNote(
      root,
      noteApp.ownerId,
      {vaultId, noteId, contentId: randomUUID()},
      {title: null, content: `<p>${content}</p>`},
    )
    const response = await page.request.put(`/api/note-encryption/${noteId}`, {
      headers: {
        Origin: new URL(page.url()).origin,
        'Content-Type': 'application/json',
        'x-note-encryption-protocol': '1',
      },
      data: prepareEncryptedWrite(payload, revision, null),
    })
    const result = await response.json()
    expect(result.status).toBe('success')
    return result.note.revision as string
  }
  const secondRevision = await remoteWrite(
    first.note.revision,
    'New version from another device',
  )
  await page.goto(`/en/eton/${noteId}`)
  const unlock = async () => {
    await page.getByLabel(v.passphrase, {exact: true}).fill(phrase)
    await page.getByRole('button', {name: v.unlock, exact: true}).click()
    await expect(body).toBeVisible()
  }
  await unlock()
  await expect(body).toContainText('New version from another device')
  await body.fill('Local work must survive conflict review reload')
  await expect(
    page.getByRole('status').filter({hasText: e.local}),
  ).toBeVisible()
  const thirdRevision = await remoteWrite(
    secondRevision,
    'Concurrent remote edit',
  )
  await page.reload()
  await unlock()
  await expect(
    page.getByRole('button', {name: e.keepMine, exact: true}),
  ).toBeVisible()
  await page.reload()
  await unlock()
  await expect(
    page.getByRole('button', {name: e.keepMine, exact: true}),
  ).toBeVisible()
  const resolved = page.waitForRequest(
    (request) =>
      request.method() === 'PUT' &&
      request.url().includes('/api/note-encryption/'),
  )
  await page.getByRole('button', {name: e.keepMine, exact: true}).click()
  expect((await resolved).postDataJSON().expectedRevision).toBe(thirdRevision)
  await expect(
    page.getByRole('status').filter({hasText: e.synced}),
  ).toBeVisible({timeout: 25_000})
  await expect(body).toContainText('Local work must survive')
})

test('lost acknowledgement preserves exact flight while later edits sync after retry', async ({
  page,
  noteApp,
}) => {
  test.setTimeout(90_000)
  await enroll(page, noteApp.ownerId)
  const body = page.getByRole('textbox', {name: e.body, exact: true})
  await body.fill('First acknowledged only on server')
  let lost = false
  const requests: string[] = []
  await page.route('**/api/note-encryption/*', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue()
    requests.push(route.request().postData()!)
    if (!lost) {
      lost = true
      await route.fetch()
      await route.abort('failed')
    } else await route.continue()
  })
  await page.getByRole('button', {name: e.save, exact: true}).click()
  await expect.poll(() => lost).toBe(true)
  await expect(
    page.getByRole('status').filter({hasText: e.local}),
  ).toBeVisible()
  await body.fill('Later edits must survive the old exact retry')
  await page.getByRole('button', {name: e.save, exact: true}).click()
  await expect.poll(() => requests.length).toBeGreaterThanOrEqual(2)
  expect(requests[1]).toBe(requests[0])
  await expect(
    page.getByRole('status').filter({hasText: e.synced}),
  ).toBeVisible({timeout: 25_000})
  expect(requests.length).toBeGreaterThanOrEqual(3)
  await expect(body).toContainText('Later edits must survive')
})

test('quota failure blocks lock and keeps preceding ciphertext checkpoint', async ({
  page,
  noteApp,
}) => {
  test.setTimeout(90_000)
  await enroll(page, noteApp.ownerId)
  await page.route('**/api/note-encryption/*', (route) =>
    route.request().method() === 'PUT'
      ? route.abort('failed')
      : route.continue(),
  )
  const body = page.getByRole('textbox', {name: e.body, exact: true})
  await body.fill('Preceding durable checkpoint')
  await expect(
    page.getByRole('status').filter({hasText: e.local}),
  ).toBeVisible()
  const before = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('etoN-encrypted-note-recovery')
      r.onsuccess = () => resolve(r.result)
    })
    const result = await new Promise<string>((resolve) => {
      const r = database
        .transaction('payloads')
        .objectStore('payloads')
        .getAll()
      r.onsuccess = () => resolve(JSON.stringify(r.result))
    })
    database.close()
    return result
  })
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      if (this.name === 'payloads')
        throw new DOMException('Synthetic quota', 'QuotaExceededError')
      return original.apply(this, args)
    }
    ;(window as unknown as {restoreQuota: () => void}).restoreQuota = () => {
      IDBObjectStore.prototype.put = original
    }
  })
  await body.fill('New edits exist only in this tab')
  await page.getByRole('button', {name: v.lock, exact: true}).click()
  await expect(
    page.getByText(messages.note.encryption.blocked, {exact: true}),
  ).toBeVisible()
  await expect(body).not.toBeVisible()
  expect(before).not.toContain('Preceding durable checkpoint')
  await page.evaluate(() => {
    ;(window as unknown as {restoreQuota: () => void}).restoreQuota()
  })
  await page
    .getByRole('button', {name: messages.note.encryption.retry, exact: true})
    .click()
  await expect(
    page.getByText(messages.note.encryption.blocked, {exact: true}),
  ).not.toBeVisible()
  await expect(page.getByText(v.locked, {exact: true})).toBeVisible()
})

test('thirty seconds of delayed crypto keeps finite monotonic checkpoints', async ({
  page,
  noteApp,
}) => {
  test.setTimeout(90_000)
  await enroll(page, noteApp.ownerId)
  await page.route('**/api/note-encryption/*', (route) =>
    route.request().method() === 'PUT'
      ? route.abort('failed')
      : route.continue(),
  )
  await page.evaluate(() => {
    const original = SubtleCrypto.prototype.encrypt
    let active = 0,
      max = 0
    SubtleCrypto.prototype.encrypt = async function (
      ...args: Parameters<SubtleCrypto['encrypt']>
    ) {
      active++
      max = Math.max(max, active)
      await new Promise((resolve) => setTimeout(resolve, 350))
      try {
        return await original.apply(this, args)
      } finally {
        active--
      }
    }
    ;(window as unknown as {encryptionMax: () => number}).encryptionMax = () =>
      max
  })
  const body = page.getByRole('textbox', {name: e.body, exact: true})
  const start = Date.now()
  let generation = 0
  while (Date.now() - start < 30_000) {
    await body.fill(`Synthetic sustained generation ${++generation}`)
    await page.waitForTimeout(150)
  }
  await expect(page.getByRole('status').filter({hasText: e.local})).toBeVisible(
    {timeout: 10_000},
  )
  expect(
    await page.evaluate(() =>
      (window as unknown as {encryptionMax: () => number}).encryptionMax(),
    ),
  ).toBeLessThanOrEqual(3)
  await page.getByRole('button', {name: v.lock, exact: true}).click()
  await expect(body).not.toBeVisible()
})
