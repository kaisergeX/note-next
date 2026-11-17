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
async function enroll(page: Page, ownerId: string, origin?: string) {
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
  await page.goto(`${origin ?? ''}/en/collection/encrypted`)
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
  return {phrase, root, vaultId}
}

type TestModeMarker = Pick<
  RecoveryHeader,
  'ownerId' | 'stableNoteId' | 'id'
> & {
  mode: 'encrypted'
  epoch: number
}

async function checkpointPair(
  page: Page,
  select?: {id: string} | {retainedFor: string},
) {
  return page.evaluate(async (select) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('etoN-encrypted-note-recovery')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const tx = database.transaction(['headers', 'payloads', 'modes'])
      const read = <T>(store: string) =>
        new Promise<T[]>((resolve, reject) => {
          const request = tx.objectStore(store).getAll()
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
      const [headers, payloads, modes] = await Promise.all([
        read<RecoveryHeader>('headers'),
        read<{id: string; envelope: SealedEnvelope}>('payloads'),
        read<TestModeMarker>('modes'),
      ])
      const header = headers
        .filter((h) => {
          if (!select) return h.status !== 'retained'
          if ('id' in select) return h.id === select.id
          return (
            h.status === 'retained' && h.stableNoteId === select.retainedFor
          )
        })
        .sort((a, b) => b.updatedAt - a.updatedAt)[0]
      return {
        header,
        envelope: payloads.find((p) => p.id === header.id)!.envelope,
        mode: modes.find(
          (m) =>
            m.ownerId === header.ownerId &&
            m.stableNoteId === header.stableNoteId,
        ),
      }
    } finally {
      database.close()
    }
  }, select)
}

async function installCheckpoints(
  page: Page,
  pairs: {header: RecoveryHeader; envelope: SealedEnvelope}[],
  clear = false,
  mode?: TestModeMarker,
) {
  await page.evaluate(
    async ({pairs, clear, mode}) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('etoN-encrypted-note-recovery')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = database.transaction(
            ['headers', 'payloads', 'modes'],
            'readwrite',
          )
          if (mode) tx.objectStore('modes').put(mode)
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
    {pairs, clear, mode},
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

test('closed creation can stage refused encrypted work into a reviewed existing note', async ({
  page,
  noteApp,
}) => {
  test.skip(
    !process.env.NOTES_CLOSED_CREATION_ORIGIN,
    'Set NOTES_CLOSED_CREATION_ORIGIN to the local preview with creation disabled.',
  )
  test.setTimeout(90_000)
  const closedOrigin = process.env.NOTES_CLOSED_CREATION_ORIGIN!
  const enabledOrigin = process.env.NOTES_TEST_ORIGIN!
  await page.setViewportSize({width: 390, height: 844})
  const {root, phrase, vaultId} = await enroll(page, noteApp.ownerId)
  const targetId = randomUUID()
  const targetTitle = 'Destination' + 'X'.repeat(110)
  const targetPayload = await sealNote(
    root,
    noteApp.ownerId,
    {vaultId, noteId: targetId, contentId: randomUUID()},
    {
      title: `<p>${targetTitle}</p>`,
      content: '<p>Existing destination content</p>',
    },
  )
  const targetResponse = await page.request.put(
    `${enabledOrigin}/api/note-encryption/${targetId}`,
    {
      headers: {
        Origin: enabledOrigin,
        'x-note-encryption-protocol': '1',
      },
      data: prepareEncryptedWrite(targetPayload, null, null),
    },
  )
  const targetResult = await targetResponse.json()
  expect(targetResult.status).toBe('success')
  const targetRevision = targetResult.note.revision as string

  const body = page.getByRole('textbox', {name: e.body, exact: true})
  await body.fill('Rich text refused creation')
  await body.press('Control+a')
  await body.press('Control+b')
  await page.getByRole('button', {name: v.lock, exact: true}).click()
  await expect(page.getByLabel(v.passphrase, {exact: true})).toBeVisible()
  const preparedSource = await checkpointPair(page)
  expect(preparedSource.mode?.epoch).toBe(preparedSource.header.capturedEpoch)
  await page.goto(`${closedOrigin}/en/collection/encrypted`)
  await expect(
    page.getByRole('button', {name: v.unlock, exact: true}),
  ).toBeVisible()
  // The second preview represents a server flag change on the same device.
  // Restore the original sealed checkpoint together with its actual mode fence.
  await installCheckpoints(page, [preparedSource], false, preparedSource.mode)
  await page.reload()
  await unlock(page, phrase)
  await expect(
    page.getByRole('button', {
      name: messages.note.encryption.create,
      exact: true,
    }),
  ).toHaveCount(0)
  const writes: {url: string; body: string}[] = []
  page.on('request', (request) => {
    if (
      request.method() === 'PUT' &&
      request.url().includes('/api/note-encryption/')
    )
      writes.push({url: request.url(), body: request.postData() ?? ''})
  })
  await page
    .getByRole('button', {name: /Browser version/})
    .first()
    .click()
  await expect(
    page.getByRole('status').filter({hasText: e.disabled}),
  ).toBeVisible()
  expect(writes).toHaveLength(1)
  expect(new URL(writes[0].url).origin).toBe(closedOrigin)

  const source = await checkpointPair(page)
  const sourceRecord = validateRecoveryPayload(
    await openRecovery(
      root,
      recoveryRouteFromHeader(source.header),
      source.envelope,
    ),
    recoveryRouteFromHeader(source.header),
  )
  expect(sourceRecord.draft.content).toContain(
    '<strong>Rich text refused creation</strong>',
  )
  expect(sourceRecord.refusal).toBe('disabled')
  const sourceFlight = sourceRecord.flight!.request

  await page
    .getByRole('button', {name: 'Review recovery destinations', exact: true})
    .click()
  const destination = page.getByRole('button', {
    name: `Review: ${targetTitle}`,
    exact: true,
  })
  await expect(destination).toBeVisible()
  expect(
    await destination.evaluate(
      (button) => button.getBoundingClientRect().right,
    ),
  ).toBeLessThanOrEqual(390)
  await destination.click()
  const confirmation = page.getByRole('dialog')
  await expect(confirmation).toContainText('Existing destination content')
  await confirmation.getByRole('button', {name: 'Cancel', exact: true}).click()
  await expect(confirmation).not.toBeVisible()
  expect(writes).toHaveLength(1)
  await destination.click()
  const secondConfirmation = page.getByRole('dialog')
  await expect(secondConfirmation).toContainText('Existing destination content')
  // Another device saves after the user sees the preview. Staging must
  // reject that stale choice and show the new content before proceeding.
  const changedContent = '<p>Destination updated on another device</p>'
  const changedPayload = await sealNote(
    root,
    noteApp.ownerId,
    {vaultId, noteId: targetId, contentId: randomUUID()},
    {title: `<p>${targetTitle}</p>`, content: changedContent},
  )
  const changedResponse = await page.request.put(
    `${enabledOrigin}/api/note-encryption/${targetId}`,
    {
      headers: {Origin: enabledOrigin, 'x-note-encryption-protocol': '1'},
      data: prepareEncryptedWrite(changedPayload, targetRevision, null),
    },
  )
  const changed = await changedResponse.json()
  expect(changed.status).toBe('success')
  await secondConfirmation
    .getByRole('button', {name: e.recoverStage, exact: true})
    .click()
  await expect(page.getByText(e.recoverFailed, {exact: true})).toBeVisible()
  expect(writes).toHaveLength(1)
  await destination.click()
  await expect(secondConfirmation).toContainText(
    'Destination updated on another device',
  )
  await secondConfirmation
    .getByRole('button', {name: 'Stage copy for review', exact: true})
    .click()
  await expect(
    page.getByRole('heading', {name: e.review, exact: true}),
  ).toBeVisible()
  await expect(
    page.getByText('Destination updated on another device', {exact: true}),
  ).toBeVisible()
  await page.getByRole('button', {name: e.keepMine, exact: true}).waitFor()
  expect(writes).toHaveLength(1)

  const saveRequest = page.waitForRequest(
    (request) =>
      request.method() === 'PUT' &&
      request.url() === `${closedOrigin}/api/note-encryption/${targetId}`,
  )
  await page.getByRole('button', {name: e.keepMine, exact: true}).click()
  const saved = await saveRequest
  const savedWrite = JSON.parse(saved.postData()!)
  expect(savedWrite.operation).toBe('save')
  expect(savedWrite.expectedRevision).toBe(changed.note.revision)
  expect(savedWrite.mutationId).not.toBe(JSON.parse(sourceFlight).mutationId)
  await expect(
    page.getByRole('status').filter({hasText: e.synced}),
  ).toBeVisible({timeout: 25_000})
  await expect.poll(() => writes.length).toBe(2)
  expect(new URL(writes[1].url).pathname).toBe(
    `/api/note-encryption/${targetId}`,
  )

  const preserved = await checkpointPair(page, {retainedFor: targetId})
  const preservedRoute = recoveryRouteFromHeader(preserved.header)
  const beforeReplace = validateRecoveryPayload(
    await openRecovery(root, preservedRoute, preserved.envelope),
    preservedRoute,
  )
  expect(beforeReplace.conflict?.content).toBe(changedContent)
  expect(beforeReplace.draft.content).toBe(sourceRecord.draft.content)
  const staged = await checkpointPair(page, {id: source.header.id})
  expect(staged.header).toEqual(source.header)
  expect(staged.envelope).toEqual(source.envelope)
  const savedResponse = await saved.response()
  expect(savedResponse).not.toBeNull()
  const savedResult = await savedResponse!.json()
  const decrypted = await openNote(
    root,
    noteApp.ownerId,
    savedResult.note.encryptedPayload,
    {vaultId, noteId: targetId},
  )
  expect(decrypted.content).toContain(
    '<strong>Rich text refused creation</strong>',
  )
})

test('enabled creation stages refused work as a distinct encrypted note', async ({
  page,
  noteApp,
}) => {
  const {root} = await enroll(page, noteApp.ownerId)
  const body = page.getByRole('textbox', {name: e.body, exact: true})
  await body.fill('Separate encrypted recovery copy')
  await body.press('Control+a')
  await body.press('Control+b')
  const writes: {url: string; body: string}[] = []
  await page.route('**/api/note-encryption/*', async (route) => {
    if (route.request().method() !== 'PUT') return route.continue()
    writes.push({
      url: route.request().url(),
      body: route.request().postData() ?? '',
    })
    if (writes.length === 1) return route.fulfill({json: {status: 'disabled'}})
    return route.continue()
  })
  await page.getByRole('button', {name: e.save, exact: true}).click()
  await expect(
    page.getByRole('status').filter({hasText: e.disabled}),
  ).toBeVisible()
  const source = await checkpointPair(page)
  const sourceRecord = validateRecoveryPayload(
    await openRecovery(
      root,
      recoveryRouteFromHeader(source.header),
      source.envelope,
    ),
    recoveryRouteFromHeader(source.header),
  )
  await page
    .getByRole('button', {name: 'Copy to a new encrypted note', exact: true})
    .click()
  const confirmation = page.getByRole('dialog')
  await expect(confirmation).toContainText('Create a separate encrypted note')
  await confirmation
    .getByRole('button', {name: 'Create copy and sync', exact: true})
    .click()
  await expect.poll(() => writes.length).toBeGreaterThanOrEqual(2)
  await expect(
    page.getByRole('status').filter({hasText: e.synced}),
  ).toBeVisible({timeout: 25_000})
  expect(new URL(writes[1].url).pathname).not.toBe(
    new URL(writes[0].url).pathname,
  )
  const originalFlight = JSON.parse(sourceRecord.flight!.request)
  const recoveredWrite = JSON.parse(writes[1].body)
  expect(recoveredWrite.operation).toBe('create')
  expect(recoveredWrite.mutationId).not.toBe(originalFlight.mutationId)
  expect(recoveredWrite.payload.noteId).not.toBe(originalFlight.payload.noteId)
  const response = await page.request.get(
    `/api/note-encryption/${recoveredWrite.payload.noteId}`,
  )
  const result = await response.json()
  expect(result.status).toBe('success')
  const recovered = await openNote(
    root,
    noteApp.ownerId,
    result.note.encryptedPayload,
    {
      vaultId: sourceRecord.route.vaultId,
      noteId: recoveredWrite.payload.noteId,
    },
  )
  expect(recovered.content).toContain(
    '<strong>Separate encrypted recovery copy</strong>',
  )
  const retained = await checkpointPair(page, {id: source.header.id})
  expect(retained.header).toEqual(source.header)
  expect(retained.envelope).toEqual(source.envelope)
  expect(writes).toHaveLength(2)
})

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

for (const resolution of ['mine', 'double remote', 'retry mine'] as const) {
  test(`reopen preserves conflict revision and resolves ${resolution}`, async ({
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
      const response = await page.request.put(
        `/api/note-encryption/${noteId}`,
        {
          headers: {
            Origin: new URL(page.url()).origin,
            'Content-Type': 'application/json',
            'x-note-encryption-protocol': '1',
          },
          data: prepareEncryptedWrite(payload, revision, null),
        },
      )
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
    if (resolution === 'retry mine') {
      await page.evaluate(() => {
        const original = IDBObjectStore.prototype.put
        IDBObjectStore.prototype.put = function (
          ...args: Parameters<IDBObjectStore['put']>
        ) {
          if (this.name === 'headers' && args[0].status !== 'retained') {
            IDBObjectStore.prototype.put = original
            throw new DOMException('Synthetic quota', 'QuotaExceededError')
          }
          return original.apply(this, args)
        }
      })
    }
    if (resolution === 'double remote') {
      const before = await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve) => {
          const request = indexedDB.open('etoN-encrypted-note-recovery')
          request.onsuccess = () => resolve(request.result)
        })
        const count = await new Promise<number>((resolve) => {
          const request = db
            .transaction('headers')
            .objectStore('headers')
            .count()
          request.onsuccess = () => resolve(request.result)
        })
        db.close()
        return count
      })
      await page
        .getByRole('button', {name: e.useRemote, exact: true})
        .evaluate((button) => {
          ;(button as HTMLButtonElement).click()
          ;(button as HTMLButtonElement).click()
        })
      await expect(
        page.getByRole('button', {name: e.useRemote, exact: true}),
      ).not.toBeVisible()
      await expect(body).toContainText('Concurrent remote edit')
      await expect(
        page.getByRole('status').filter({hasText: e.synced}),
      ).toBeVisible()
      const pair = await checkpointPair(page)
      const opened = await openRecovery(
        root,
        recoveryRouteFromHeader(pair.header),
        pair.envelope,
      )
      const record = validateRecoveryPayload(
        opened,
        recoveryRouteFromHeader(pair.header),
      )
      expect(record.draft.content).toContain('Concurrent remote edit')
      expect(record.baseline?.content).toContain('Concurrent remote edit')
      // One retained original is added even when both events precede a React render.
      const after = await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve) => {
          const request = indexedDB.open('etoN-encrypted-note-recovery')
          request.onsuccess = () => resolve(request.result)
        })
        const count = await new Promise<number>((resolve) => {
          const request = db
            .transaction('headers')
            .objectStore('headers')
            .count()
          request.onsuccess = () => resolve(request.result)
        })
        db.close()
        return count
      })
      expect(after).toBe(before + 1)
      await page.getByRole('button', {name: v.lock, exact: true}).click()
      await expect(page.getByText(v.locked, {exact: true})).toBeVisible()
      return
    }
    const resolved = page.waitForRequest(
      (request) =>
        request.method() === 'PUT' &&
        request.url().includes('/api/note-encryption/'),
    )
    await page.getByRole('button', {name: e.keepMine, exact: true}).click()
    if (resolution === 'retry mine') {
      await expect(
        page.getByRole('alert').filter({hasText: e.failure}),
      ).toBeVisible()
      await expect(
        page.getByRole('button', {name: e.keepMine, exact: true}),
      ).not.toBeVisible()
      await expect(body).toContainText('Local work must survive')
      await page.getByRole('button', {name: e.retry, exact: true}).click()
    }
    expect((await resolved).postDataJSON().expectedRevision).toBe(thirdRevision)
    await expect(
      page.getByRole('status').filter({hasText: e.synced}),
    ).toBeVisible({timeout: 25_000})
    await expect(body).toContainText('Local work must survive')
  })
}

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
