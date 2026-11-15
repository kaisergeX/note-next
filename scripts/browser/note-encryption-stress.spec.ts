import {randomUUID} from 'node:crypto'
import type {Page} from '@playwright/test'
import {test, expect} from './fixtures'
import {
  generateRoot,
  generatePassphraseSalt,
  wrapRoot,
  importRoot,
  openRecovery,
  openNote,
  sealRecovery,
  sealNote,
} from '../../lib/notes/encryption/crypto'
import {prepareEncryptedWrite} from '../../lib/notes/encryption/sync'
import {
  recoveryRouteFromHeader,
  type RecoveryHeader,
} from '../../lib/notes/encryption/storage'
import {
  validateRecoveryPayload,
  type RecoveryPayload,
} from '../../lib/notes/encryption/recovery'
import type {SealedEnvelope} from '../../lib/notes/encryption/protocol'
import {PASSPHRASE_PROFILE} from '../../lib/notes/encryption/protocol'
import messages from '../../dictionaries/en.json' with {type: 'json'}

const v = messages.note.vault,
  e = messages.note.encryptedEditor

test('repeated unlock cannot invalidate an active editor or lose subsequent work', async ({
  page,
  context,
  noteApp,
}) => {
  const {phrase} = await enroll(page, noteApp.ownerId)
  const body = page.getByRole('textbox', {name: e.body, exact: true})
  await context.setOffline(true)
  try {
    await body.fill('Before repeated unlock')
    await expect(
      page.getByRole('status').filter({hasText: e.local}),
    ).toBeVisible()
    await page.getByLabel(v.passphrase, {exact: true}).fill(phrase)
    const button = page.getByRole('button', {name: v.unlock, exact: true})
    if (await button.isEnabled()) {
      await button.click()
      await expect(page.getByLabel(v.passphrase, {exact: true})).toHaveValue('')
    }
    await body.fill('After repeated unlock must remain durable')
    await page.getByRole('button', {name: v.lock, exact: true}).click()
    await unlock(page, phrase)
    await expect(body).toContainText(
      'After repeated unlock must remain durable',
    )
  } finally {
    await context.setOffline(false)
  }
})

test('expired authentication pauses the exact sealed flight until the same owner explicitly resumes', async ({
  page,
  context,
  noteApp,
}) => {
  test.setTimeout(90_000)
  const {phrase, root} = await enroll(page, noteApp.ownerId)
  const body = page.getByRole('textbox', {name: e.body, exact: true})
  await body.fill('Work sealed before expired-session upload')
  await noteApp.signIn('primary', -60)
  const requests: string[] = []
  context.on('request', (request) => {
    if (
      request.method() === 'PUT' &&
      request.url().includes('/api/note-encryption/')
    )
      requests.push(request.postData()!)
  })
  await page.clock.install()
  const expired = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().includes('/api/note-encryption/'),
  )
  await page.getByRole('button', {name: e.save, exact: true}).click()
  expect((await expired).status()).toBe(401)
  await page.waitForTimeout(100)
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.clock.runFor(11_000)
    await page.waitForTimeout(100)
  }
  expect(requests).toHaveLength(1)
  await expect(
    page.getByRole('status').filter({hasText: e.unauthenticated}),
  ).toBeVisible()
  const pair = await checkpointPair(page)
  const record = validateRecoveryPayload(
    await openRecovery(
      root,
      recoveryRouteFromHeader(pair.header),
      pair.envelope,
    ),
    recoveryRouteFromHeader(pair.header),
  )
  expect(record.authenticationRequired).toBe(true)
  expect(record.flight?.request).toBe(requests[0])
  await body.fill('Later edit while sign-in is required')
  await page.clock.runFor(3000)
  await page.getByRole('button', {name: v.lock, exact: true}).click()
  await unlock(page, phrase)
  await expect(body).toContainText('Later edit while sign-in is required')
  await expect(
    page.getByRole('status').filter({hasText: e.unauthenticated}),
  ).toBeVisible()
  await noteApp.signIn('secondary')
  await page
    .getByRole('button', {name: e.resumeAfterSignIn, exact: true})
    .click()
  await page.clock.runFor(65_000)
  expect(requests).toHaveLength(1)
  await noteApp.signIn('primary')
  await page
    .getByRole('button', {name: e.resumeAfterSignIn, exact: true})
    .click()
  await expect.poll(() => requests.length).toBeGreaterThanOrEqual(2)
  expect(requests[1]).toBe(requests[0])
  await page.clock.runFor(11_000)
  await expect(
    page.getByRole('status').filter({hasText: e.synced}),
  ).toBeVisible()
  await expect(body).toContainText('Later edit while sign-in is required')
})
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

async function checkpointPair(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('etoN-encrypted-note-recovery')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const tx = database.transaction(['headers', 'payloads'])
      const read = <T>(store: string) =>
        new Promise<T[]>((resolve, reject) => {
          const request = tx.objectStore(store).getAll()
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
      const [headers, payloads] = await Promise.all([
        read<RecoveryHeader>('headers'),
        read<{id: string; envelope: SealedEnvelope}>('payloads'),
      ])
      const header = headers
        .filter((h) => h.status !== 'retained')
        .sort((a, b) => b.updatedAt - a.updatedAt)[0]
      return {
        header,
        envelope: payloads.find((p) => p.id === header.id)!.envelope,
      }
    } finally {
      database.close()
    }
  })
}

async function installCheckpoints(
  page: Page,
  pairs: {header: RecoveryHeader; envelope: SealedEnvelope}[],
  clear = false,
) {
  await page.evaluate(
    async ({pairs, clear}) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('etoN-encrypted-note-recovery')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = database.transaction(['headers', 'payloads'], 'readwrite')
          if (clear) {
            tx.objectStore('headers').clear()
            tx.objectStore('payloads').clear()
          }
          for (const {header, envelope} of pairs) {
            tx.objectStore('headers').put(header)
            tx.objectStore('payloads').put({
              id: header.id,
              ownerId: header.ownerId,
              envelope,
            })
          }
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
          tx.onabort = () => reject(tx.error)
        })
      } finally {
        database.close()
      }
    },
    {pairs, clear},
  )
}

async function savedFixture(page: Page, ownerId: string) {
  const vault = await enroll(page, ownerId)
  await page
    .getByRole('textbox', {name: e.body, exact: true})
    .fill('Server baseline')
  await page.getByRole('button', {name: e.save, exact: true}).click()
  await expect(
    page.getByRole('status').filter({hasText: e.synced}),
  ).toBeVisible()
  const pair = await checkpointPair(page)
  const record = validateRecoveryPayload(
    await openRecovery(
      vault.root,
      recoveryRouteFromHeader(pair.header),
      pair.envelope,
    ),
    recoveryRouteFromHeader(pair.header),
  )
  return {
    ...vault,
    pair,
    record,
    noteId: record.route.stableNoteId,
    vaultId: record.route.vaultId,
  }
}

async function unlock(page: Page, phrase: string) {
  await page.getByLabel(v.passphrase, {exact: true}).fill(phrase)
  await page.getByRole('button', {name: v.unlock, exact: true}).click()
}

async function remoteSave(
  page: Page,
  root: CryptoKey,
  record: RecoveryPayload,
  content: string,
) {
  const noteId = record.route.stableNoteId
  const payload = await sealNote(
    root,
    record.route.ownerId,
    {
      vaultId: record.route.vaultId,
      noteId,
      contentId: randomUUID(),
    },
    {title: null, content: `<p>${content}</p>`},
  )
  const response = await page.request.put(`/api/note-encryption/${noteId}`, {
    headers: {
      Origin: new URL(page.url()).origin,
      'x-note-encryption-protocol': '1',
    },
    data: prepareEncryptedWrite(payload, record.route.expectedRevision, null),
  })
  const result = await response.json()
  expect(result.status).toBe('success')
  return result.note
}

test('fresh remote edit stays local through lock and reconciles a newer server version', async ({
  page,
  noteApp,
}) => {
  const {root, phrase, noteId, record} = await savedFixture(
    page,
    noteApp.ownerId,
  )
  await page.getByRole('button', {name: v.lock, exact: true}).click()
  // An existing server note on a profile with no checkpoint exercises the alias bug.
  await installCheckpoints(page, [], true)
  await page.goto(`/en/eton/${noteId}`)
  await unlock(page, phrase)
  const body = page.getByRole('textbox', {name: e.body, exact: true})
  await body.fill('Unsent edit from fresh profile')
  await expect(
    page.getByRole('status').filter({hasText: e.local}),
  ).toBeVisible()
  await page.getByRole('button', {name: v.lock, exact: true}).click()
  await unlock(page, phrase)
  await expect(body).toHaveText('Unsent edit from fresh profile')
  await expect(
    page.getByRole('status').filter({hasText: e.local}),
  ).toBeVisible()
  await page.getByRole('button', {name: v.lock, exact: true}).click()
  await remoteSave(page, root, record, 'New remote version')
  let writes = 0
  page.on('request', (request) => {
    if (
      request.method() === 'PUT' &&
      request.url().includes('/api/note-encryption/')
    )
      writes++
  })
  await unlock(page, phrase)
  await expect(body).toHaveText('Unsent edit from fresh profile')
  await expect(
    page.getByRole('button', {name: e.keepMine, exact: true}),
  ).toBeVisible()
  await expect(
    page.getByText('New remote version', {exact: true}),
  ).toBeVisible()
  await page.clock.install()
  await page.clock.runFor(65_000)
  expect(writes).toBe(0)
})

for (const changedRevision of [false, true]) {
  test(`legacy equal baseline preserves unsent work (remote changed: ${changedRevision})`, async ({
    page,
    noteApp,
  }) => {
    const {root, phrase, pair, record, noteId} = await savedFixture(
      page,
      noteApp.ownerId,
    )
    await page.getByRole('button', {name: v.lock, exact: true}).click()
    // The affected release serializes an unsent draft as its own baseline.
    delete (record as RecoveryPayload & {baselineVerified?: true})
      .baselineVerified
    record.draft.content = '<p>Legacy unsent content</p>'
    record.baseline = structuredClone(record.draft)
    record.route.generation++
    await installCheckpoints(page, [
      {
        header: {...pair.header, ...record.route, status: 'synced'},
        envelope: await sealRecovery(root, record.route, record),
      },
    ])
    if (changedRevision)
      await remoteSave(page, root, record, 'New authoritative content')
    await page.goto(`/en/eton/${noteId}`)
    await unlock(page, phrase)
    await expect(
      page.getByRole('textbox', {name: e.body, exact: true}),
    ).toHaveText('Legacy unsent content')
    await expect(
      page.getByRole('button', {name: e.keepMine, exact: true}),
    ).toBeVisible()
    await expect(
      page.getByText(
        changedRevision ? 'New authoritative content' : 'Server baseline',
        {exact: true},
      ),
    ).toBeVisible()
  })
}

test('legacy checkpoint stays local offline and reconciles before reconnect can save', async ({
  page,
  noteApp,
  context,
}) => {
  const {root, phrase, pair, record, noteId} = await savedFixture(
    page,
    noteApp.ownerId,
  )
  await page.getByRole('button', {name: v.lock, exact: true}).click()
  delete record.baselineVerified
  record.draft.content = '<p>Uncertain legacy edit offline</p>'
  record.baseline = structuredClone(record.draft)
  record.route.generation++
  await installCheckpoints(page, [
    {
      header: {...pair.header, ...record.route},
      envelope: await sealRecovery(root, record.route, record),
    },
  ])
  await page.goto(`/en/eton/${noteId}`)
  await expect(page.getByLabel(v.passphrase, {exact: true})).toBeVisible()
  let writes = 0
  page.on('request', (request) => {
    if (
      request.method() === 'PUT' &&
      request.url().includes('/api/note-encryption/')
    )
      writes++
  })
  await page.clock.install()
  await context.setOffline(true)
  await unlock(page, phrase)
  await expect(
    page.getByRole('textbox', {name: e.body, exact: true}),
  ).toHaveText('Uncertain legacy edit offline')
  await expect(
    page.getByRole('status').filter({hasText: e.review_required}),
  ).toBeVisible()
  await page.clock.runFor(65_000)
  expect(writes).toBe(0)
  await context.setOffline(false)
  await expect(
    page.getByRole('button', {name: e.keepMine, exact: true}),
  ).toBeVisible()
  await expect(
    page.getByRole('textbox', {name: e.body, exact: true}),
  ).toHaveText('Uncertain legacy edit offline')
  await page.clock.runFor(65_000)
  expect(writes).toBe(0)
})

test('recovery selection and working reopen reach beyond fifty headers', async ({
  page,
  noteApp,
}) => {
  const {root, phrase, pair, record, noteId} = await savedFixture(
    page,
    noteApp.ownerId,
  )
  await page.getByRole('button', {name: v.lock, exact: true}).click()
  const ids = Array.from({length: 53}, () => randomUUID()).sort()
  const pairs = []
  for (let i = 0; i < ids.length; i++) {
    const copy = structuredClone(record)
    copy.route.recordId = ids[i]
    copy.draft.content = `<p>${i === 51 ? 'Selected retained version' : i === 52 ? 'Current working checkpoint' : `Retained ${i}`}</p>`
    pairs.push({
      header: {
        ...pair.header,
        ...copy.route,
        id: ids[i],
        versionId: ids[i],
        status: i === 52 ? ('local' as const) : ('retained' as const),
        updatedAt: Date.now() + i,
      },
      envelope: await sealRecovery(root, copy.route, copy),
    })
  }
  await installCheckpoints(page, pairs, true)
  await page.addInitScript(() => {
    let reads = 0
    const get = IDBObjectStore.prototype.get
    IDBObjectStore.prototype.get = function (
      ...args: Parameters<IDBObjectStore['get']>
    ) {
      if (this.name === 'payloads') reads++
      return get.apply(this, args)
    }
    ;(window as unknown as {payloadReads: () => number}).payloadReads = () =>
      reads
  })
  await page.goto('/en/collection/encrypted')
  await unlock(page, phrase)
  await expect(page.getByRole('button', {name: /Browser version/})).toHaveCount(
    50,
  )
  expect(
    await page.evaluate(() =>
      (window as unknown as {payloadReads: () => number}).payloadReads(),
    ),
  ).toBe(0)
  // Retained record 51 is on the list's first page, outside the old note lookup.
  await page
    .getByRole('button', {name: new RegExp('Browser version')})
    .nth(1)
    .click()
  await expect(
    page.getByRole('textbox', {name: e.body, exact: true}),
  ).toHaveText('Selected retained version')
  expect(
    await page.evaluate(() =>
      (window as unknown as {payloadReads: () => number}).payloadReads(),
    ),
  ).toBe(1)
  await page.getByRole('button', {name: v.lock, exact: true}).click()
  const retained = await page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('etoN-encrypted-note-recovery')
      r.onsuccess = () => resolve(r.result)
    })
    const row = await new Promise<unknown>((resolve) => {
      const r = db.transaction('payloads').objectStore('payloads').get(id)
      r.onsuccess = () => resolve(r.result)
    })
    db.close()
    return row
  }, ids[51])
  expect(retained).toMatchObject({envelope: pairs[51].envelope})
  // Remove only the newly reviewed copy so ordinary reopen has a distinct target.
  await installCheckpoints(page, pairs, true)
  await page.goto(`/en/eton/${noteId}`)
  await unlock(page, phrase)
  await expect(
    page.getByRole('textbox', {name: e.body, exact: true}),
  ).toHaveText('Current working checkpoint')
})

for (const corruption of [
  'missing',
  'owner',
  'vault',
  'note',
  'record',
  'authenticated route',
] as const) {
  test(`selected recovery fails safely for ${corruption}`, async ({
    page,
    noteApp,
  }) => {
    const {pair, phrase} = await savedFixture(page, noteApp.ownerId)
    await page.getByRole('button', {name: v.lock, exact: true}).click()
    await page.goto('/en/collection/encrypted')
    await unlock(page, phrase)
    const choice = page.getByRole('button', {name: /Browser version/}).first()
    await expect(choice).toBeVisible()
    // Change storage after the list render, then exercise its actual selection.
    const header = {...pair.header}
    if (corruption === 'owner') header.ownerId = randomUUID()
    if (corruption === 'vault') header.vaultId = randomUUID()
    if (corruption === 'note') header.stableNoteId = randomUUID()
    if (corruption === 'record') header.recordId = randomUUID()
    if (corruption === 'authenticated route') header.generation++
    await installCheckpoints(
      page,
      corruption === 'missing' ? [] : [{...pair, header}],
      true,
    )
    let writes = 0
    page.on('request', (request) => {
      if (
        request.method() === 'PUT' &&
        request.url().includes('/api/note-encryption/')
      )
        writes++
    })
    await choice.click()
    await expect(
      page.getByRole('alert').filter({hasText: e.recoveryFailure}),
    ).toBeVisible()
    await expect(
      page.getByRole('textbox', {name: e.body, exact: true}),
    ).not.toBeVisible()
    await expect(
      page.getByRole('button', {name: e.save, exact: true}),
    ).toBeDisabled()
    expect(writes).toBe(0)
    // Restoring the selected identity and retrying must open that record.
    await installCheckpoints(page, [pair], true)
    await page.getByRole('button', {name: e.retryOpen, exact: true}).click()
    await expect(
      page.getByRole('textbox', {name: e.body, exact: true}),
    ).toHaveText('Server baseline')
  })
}

for (const offline of [false, true]) {
  test(`dirty checkpoint without flight resumes autosave (offline reopen: ${offline})`, async ({
    page,
    noteApp,
    context,
  }) => {
    const {phrase, root, noteId} = await savedFixture(page, noteApp.ownerId)
    const body = page.getByRole('textbox', {name: e.body, exact: true})
    await body.fill('Checkpoint before first upload')
    await expect(
      page.getByRole('status').filter({hasText: e.local}),
    ).toBeVisible()
    await page.getByRole('button', {name: v.lock, exact: true}).click()
    const before = await checkpointPair(page)
    const opened = validateRecoveryPayload(
      await openRecovery(
        root,
        recoveryRouteFromHeader(before.header),
        before.envelope,
      ),
      recoveryRouteFromHeader(before.header),
    )
    expect(opened.flight).toBeNull()
    let writes = 0
    let acknowledge!: () => void
    const gate = new Promise<void>((resolve) => {
      acknowledge = resolve
    })
    await page.route('**/api/note-encryption/*', async (route) => {
      if (route.request().method() !== 'PUT') return route.continue()
      writes++
      const response = await route.fetch()
      await gate
      await route.fulfill({response})
    })
    await page.clock.install()
    if (offline) await context.setOffline(true)
    await unlock(page, phrase)
    await expect(body).toHaveText('Checkpoint before first upload')
    await expect(
      page.getByRole('status').filter({hasText: e.local}),
    ).toBeVisible()
    if (offline) {
      await page.clock.runFor(35_000)
      expect(writes).toBe(0)
      await context.setOffline(false)
    } else await page.clock.runFor(4000)
    await expect.poll(() => writes).toBe(1)
    await expect(
      page.getByRole('status').filter({hasText: e.syncing}),
    ).toBeVisible()
    await expect(
      page.getByRole('status').filter({hasText: e.synced}),
    ).not.toBeVisible()
    acknowledge()
    await expect(
      page.getByRole('status').filter({hasText: e.synced}),
    ).toBeVisible()
    const response = await page.request.get(`/api/note-encryption/${noteId}`)
    const remote = await response.json()
    expect(
      (
        await openNote(root, noteApp.ownerId, remote.note.encryptedPayload, {
          vaultId: opened.route.vaultId,
          noteId,
        })
      ).content,
    ).toBe('<p>Checkpoint before first upload</p>')
  })
}

test('clean reopen and read-only preview perform zero automatic writes', async ({
  page,
  noteApp,
}) => {
  const {phrase} = await savedFixture(page, noteApp.ownerId)
  await page.getByRole('button', {name: v.lock, exact: true}).click()
  let writes = 0
  page.on('request', (request) => {
    if (
      request.method() === 'PUT' &&
      request.url().includes('/api/note-encryption/')
    )
      writes++
  })
  await page.clock.install()
  await unlock(page, phrase)
  await expect(
    page.getByRole('status').filter({hasText: e.synced}),
  ).toBeVisible()
  await page.clock.runFor(65_000)
  expect(writes).toBe(0)
  await page.goto('/en/eton')
  await page
    .getByRole('button', {
      name: messages.note.accessibility.moreActions,
      exact: true,
    })
    .click()
  await page
    .getByRole('button', {name: messages.note.trash.move, exact: true})
    .click()
  await expect(page.locator('[data-note-id]')).toHaveCount(0)
  await page.goto('/en/collection/trash')
  await page
    .getByRole('button', {
      name: messages.note.trash.previewNamed.replace(
        '{title}',
        messages.note.encryption.lockedNote,
      ),
      exact: true,
    })
    .click()
  await unlock(page, phrase)
  await expect(
    page.getByRole('textbox', {name: e.body, exact: true}),
  ).toHaveAttribute('contenteditable', 'false')
  await page.clock.runFor(65_000)
  expect(writes).toBe(0)
})

for (const refusal of [
  'unavailable',
  'disabled',
  'invalid_input',
  'reload_required',
] as const) {
  test(`definitive ${refusal} stops retries across timers reconnect edits and reload`, async ({
    page,
    noteApp,
  }) => {
    const {root, phrase} = await enroll(page, noteApp.ownerId)
    const body = page.getByRole('textbox', {name: e.body, exact: true})
    await body.fill('Recoverable refused creation')
    let writes = 0
    await page.route('**/api/note-encryption/*', (route) => {
      if (route.request().method() !== 'PUT') return route.continue()
      writes++
      return route.fulfill({json: {status: refusal}})
    })
    await page.clock.install()
    await page.getByRole('button', {name: e.save, exact: true}).click()
    await expect(
      page.getByRole('status').filter({hasText: e[refusal]}),
    ).toBeVisible()
    const pair = await checkpointPair(page)
    const opened = validateRecoveryPayload(
      await openRecovery(
        root,
        recoveryRouteFromHeader(pair.header),
        pair.envelope,
      ),
      recoveryRouteFromHeader(pair.header),
    )
    expect(opened.draft.content).toBe('<p>Recoverable refused creation</p>')
    expect(opened.refusal).toBe(refusal)
    expect(opened.flight).not.toBeNull()
    await page.clock.runFor(65_000)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    await body.fill('More local work after refusal')
    await page.clock.runFor(65_000)
    expect(writes).toBe(1)
    await expect(
      page.getByRole('status').filter({hasText: e[refusal]}),
    ).toBeVisible()
    await page.getByRole('button', {name: v.lock, exact: true}).click()
    await page.reload()
    await unlock(page, phrase)
    await page
      .getByRole('button', {name: /Browser version/})
      .first()
      .click()
    await expect(body).toHaveText('More local work after refusal')
    await expect(
      page.getByRole('status').filter({hasText: e[refusal]}),
    ).toBeVisible()
    await page.clock.runFor(65_000)
    await page.evaluate(() => window.dispatchEvent(new Event('online')))
    expect(writes).toBe(1)
  })
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
  const {phrase, root} = await enroll(page, noteApp.ownerId)
  const body = page.getByRole('textbox', {name: e.body, exact: true})
  await body.fill('First acknowledged only on server')
  let lost = false,
    dropped = false
  const requests: string[] = []
  await page.route('**/api/note-encryption/*', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue()
    requests.push(route.request().postData()!)
    if (!lost) {
      lost = true
      await route.fetch()
      await route.abort('failed')
      dropped = true
    } else await route.continue()
  })
  await page.getByRole('button', {name: e.save, exact: true}).click()
  await expect.poll(() => dropped).toBe(true)
  await expect(
    page.getByRole('status').filter({hasText: e.local}),
  ).toBeVisible()
  await body.fill('Later edits must survive the old exact retry')
  await expect
    .poll(async () => {
      const pair = await checkpointPair(page)
      return validateRecoveryPayload(
        await openRecovery(
          root,
          recoveryRouteFromHeader(pair.header),
          pair.envelope,
        ),
        recoveryRouteFromHeader(pair.header),
      ).draft.content
    })
    .toBe('<p>Later edits must survive the old exact retry</p>')
  await page.getByRole('button', {name: v.lock, exact: true}).click()
  await page.reload()
  await unlock(page, phrase)
  await page
    .getByRole('button', {name: /Browser version/})
    .first()
    .click()
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
