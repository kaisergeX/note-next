import {createHash, randomUUID} from 'node:crypto'
import {cpus, totalmem} from 'node:os'
import {mkdir, readFile, writeFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {join} from 'node:path'
import postgres from 'postgres'
import type {Page} from '@playwright/test'
import {test, expect} from './fixtures'
import messages from '../../dictionaries/en.json' with {type: 'json'}

const v = messages.note.vault
const e = messages.note.encryptedEditor
const n = messages.note.encryption
test.use({serviceWorkers: 'allow'})

type TimingWindow = Window & {
  releaseTiming: {
    commits: Record<string, {generation: number; time: number}>
    tasks: {start: number; duration: number}[]
  }
}

test('loaded editor replacements measure input and checkpoint commits after fixture setup', async ({
  page,
  context,
  noteApp,
}) => {
  test.setTimeout(120_000)
  const ordinary = await noteApp.create()
  await activateVault(page)
  await page.getByRole('button', {name: n.create, exact: true}).click()
  await expect(
    page.getByRole('textbox', {name: e.body, exact: true}),
  ).toBeVisible()
  await page.evaluate(() => {
    const state = {commits: {}, tasks: []} as TimingWindow['releaseTiming']
    ;(window as unknown as TimingWindow).releaseTiming = state
    new PerformanceObserver((list) =>
      state.tasks.push(
        ...list
          .getEntries()
          .map((entry) => ({start: entry.startTime, duration: entry.duration})),
      ),
    ).observe({type: 'longtask'})
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      const result = put.apply(this, args)
      if (
        (this.name === 'headers' &&
          this.transaction.db.name === 'etoN-encrypted-note-recovery') ||
        (this.name === 'drafts' &&
          this.transaction.db.name === 'etoN-note-recovery')
      ) {
        const name = this.transaction.db.name
        const generation = (args[0] as {generation: number}).generation
        this.transaction.addEventListener(
          'complete',
          () => {
            state.commits[name] = {generation, time: performance.now()}
          },
          {once: true},
        )
      }
      return result
    }
  })
  // Opt-in renderer profiling retains the actual measured trace, rather than
  // assigning a later reproduction's cause to an earlier untraced long task.
  const profileDir = process.env.NOTE_ENCRYPTION_PROFILE_DIR
  const cdp = profileDir ? await context.newCDPSession(page) : null
  if (cdp)
    await cdp.send('Tracing.start', {
      categories:
        '-*,toplevel,blink.user_timing,devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.stack,v8.execute,disabled-by-default-v8.cpu_profiler',
      transferMode: 'ReturnAsStream',
    })
  const report: Record<string, unknown> = {}
  const measure = async (name: string, label: string, database: string) => {
    const start = await page.evaluate(
      ({name, profile}) =>
        profile
          ? performance.mark(`profile-start-${name}`).startTime
          : performance.now(),
      {name, profile: Boolean(profileDir)},
    )
    const samples: number[] = []
    const replacements: Record<string, unknown>[] = []
    await context.setOffline(true)
    try {
      for (let i = 0; i < 30; i++) {
        const before = await page.evaluate(
          ({database, profile}) => ({
            time: profile
              ? performance.mark(`profile-edit-${database}`).startTime
              : performance.now(),
            generation:
              (window as unknown as TimingWindow).releaseTiming.commits[
                database
              ]?.generation ?? -1,
          }),
          {database, profile: Boolean(profileDir)},
        )
        await page
          .getByRole('textbox', {name: label, exact: true})
          .fill(
            `Synthetic typing ${i} ` +
              '\u0800'.repeat(Math.floor((32 * 1024 - 100) / 3)),
          )
        await expect
          .poll(() =>
            page.evaluate(
              (database) =>
                (window as unknown as TimingWindow).releaseTiming.commits[
                  database
                ]?.generation ?? -1,
              database,
            ),
          )
          .toBeGreaterThan(before.generation)
        const commit = await page.evaluate(
          (database) =>
            (window as unknown as TimingWindow).releaseTiming.commits[database],
          database,
        )
        samples.push(commit.time - before.time)
        replacements.push({index: i, start: before.time, commit: commit.time})
      }
    } finally {
      await context.setOffline(false)
    }
    const end = await page.evaluate(() => performance.now())
    await page.waitForTimeout(100)
    const tasks = await page.evaluate(
      ({start, end}) =>
        (window as unknown as TimingWindow).releaseTiming.tasks.filter(
          (task) => task.start >= start && task.start < end,
        ),
      {start, end},
    )
    samples.sort((a, b) => a - b)
    report[name] = {
      inputKind: 'whole-body replacement using fill, not incremental key input',
      ...(profileDir ? {start, end, tasks, replacements} : {}),
      runs: samples.length,
      p50CommitMs: samples[14],
      p95CommitMs: samples[28],
      longTasksOver50Ms: tasks.length,
      maxLongTaskMs: Math.max(0, ...tasks.map((task) => task.duration)),
      includes:
        'input, editor rendering, serialization, sealing where applicable, IDB commit; excludes mounting and fixture preparation',
    }
    expect(samples[28]).toBeLessThanOrEqual(2500)
  }
  const ordinaryFirst =
    profileDir && process.env.NOTE_ENCRYPTION_PROFILE_ORDER === 'ordinary-first'
  const measureOrdinary = async () => {
    // Client-side navigation retains the observer and instrumentation.
    await page.getByRole('link', {name: 'Notes', exact: true}).click()
    await page
      .getByRole('link')
      .filter({hasText: 'Browser regression note'})
      .click()
    await expect(
      page.getByRole('textbox', {name: 'Note content', exact: true}),
    ).toBeVisible()
    expect(page.url()).toContain(ordinary.id)
    await measure('ordinary32KiB', 'Note content', 'etoN-note-recovery')
  }
  if (ordinaryFirst) {
    await measureOrdinary()
    await page
      .getByRole('button', {name: 'Save and go back', exact: true})
      .click()
    await expect(page).toHaveURL(/\/en\/eton$/)
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await page.getByRole('link', {name: 'Encrypted notes', exact: true}).click()
    await page.getByRole('button', {name: n.create, exact: true}).click()
    await expect(
      page.getByRole('textbox', {name: e.body, exact: true}),
    ).toBeVisible()
  }
  await measure('encrypted32KiB', e.body, 'etoN-encrypted-note-recovery')
  await page.getByRole('button', {name: v.lock, exact: true}).click()
  if (!ordinaryFirst) await measureOrdinary()
  if (cdp && profileDir) {
    await mkdir(profileDir, {recursive: true})
    const completion = new Promise<{
      stream?: string
      dataLossOccurred?: boolean
    }>((resolve) => cdp.once('Tracing.tracingComplete', resolve))
    await cdp.send('Tracing.end')
    const {stream, dataLossOccurred} = await completion
    if (!stream) throw new Error('Renderer trace did not return a stream')
    const chunks: Buffer[] = []
    try {
      while (true) {
        const part = await cdp.send('IO.read', {handle: stream})
        chunks.push(
          Buffer.from(part.data, part.base64Encoded ? 'base64' : 'utf8'),
        )
        if (part.eof) break
      }
    } finally {
      await cdp.send('IO.close', {handle: stream})
      await cdp.detach()
    }
    await writeFile(
      join(profileDir, 'renderer-trace.json'),
      Buffer.concat(chunks),
    )
    report.provenance = {
      measuredAt: new Date().toISOString(),
      revision: execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim(),
      buildId: (await readFile('.next/BUILD_ID', 'utf8')).trim(),
      browser: context.browser()?.version(),
      node: process.version,
      platform: process.platform,
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
      memoryGiB: totalmem() / 1024 ** 3,
      releaseSourceManifestSha256: createHash('sha256')
        .update(await readFile('docs/note-encryption-release-source.json'))
        .digest('hex'),
      runnerSha256: createHash('sha256')
        .update(
          await readFile('scripts/browser/note-encryption-release.spec.ts'),
        )
        .digest('hex'),
      dataLossOccurred: dataLossOccurred ?? false,
      traceCategoriesIncludeCpuSampling: true,
      order: ordinaryFirst ? 'ordinary-first' : 'encrypted-first',
      instrumentationOverhead:
        'CDP trace and CPU sampling enabled for both editors',
    }
  }
  await writeFile(
    profileDir
      ? join(profileDir, 'result.json')
      : '.playwright-mcp/release-typing.json',
    JSON.stringify(report, null, 2) + '\n',
  )
})

async function activateVault(page: Page) {
  await page.goto('/en/collection/encrypted')
  await page.getByRole('button', {name: v.setup, exact: true}).click()
  const phrase = await page.locator('p.font-mono').first().innerText()
  await page.getByRole('button', {name: v.reveal, exact: true}).click()
  const recovery = await page.locator('p.font-mono').nth(1).innerText()
  const confirmation = page.getByLabel(v.confirmationEntry, {exact: true})
  await confirmation.fill(phrase)
  await page.getByRole('button', {name: v.verifyPrimary, exact: true}).click()
  await expect(
    page.getByRole('button', {name: v.primaryVerified, exact: true}),
  ).toBeVisible()
  await confirmation.fill(recovery)
  await page.getByRole('button', {name: v.verifyRecovery, exact: true}).click()
  await expect(
    page.getByRole('button', {name: v.recoveryVerified, exact: true}),
  ).toBeVisible()
  await page.getByRole('button', {name: v.activate, exact: true}).click()
  await unlock(page, phrase)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => resolve(),
          {once: true},
        ),
      )
  })
  expect(
    await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
  ).toMatch(/\/sw\.js$/)
  return {phrase, recovery}
}

async function unlock(page: Page, phrase: string) {
  await page.getByLabel(v.passphrase, {exact: true}).fill(phrase)
  await page.getByRole('button', {name: v.unlock, exact: true}).click()
  await expect(
    page.getByRole('button', {name: v.lock, exact: true}),
  ).toBeVisible()
}

async function cacheContents(page: Page) {
  return page.evaluate(async () => {
    const entries: {url: string; body: string}[] = []
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) {
        const response = await cache.match(request)
        entries.push({url: request.url, body: await response!.text()})
      }
    }
    return entries
  })
}

test('active production worker preserves offline sealed edits and reconnect autosave without a document reload', async ({
  page,
  context,
  noteApp,
}) => {
  test.setTimeout(120_000)
  const {phrase} = await activateVault(page)
  await page.getByRole('button', {name: n.create, exact: true}).click()
  const body = page.getByRole('textbox', {name: e.body, exact: true})
  const sentinel = `OFFLINE-${randomUUID()}`
  await body.fill('Online baseline')
  await page.getByRole('button', {name: e.save, exact: true}).click()
  await expect(
    page.getByRole('status').filter({hasText: e.synced}),
  ).toBeVisible()
  await page.getByRole('button', {name: v.lock, exact: true}).click()
  await context.setOffline(true)
  try {
    await unlock(page, phrase)
    await expect(body).toBeVisible()
    await body.fill(sentinel)
    await expect(
      page.getByRole('status').filter({hasText: e.local}),
    ).toBeVisible()
    await page.getByRole('button', {name: v.lock, exact: true}).click()
    await unlock(page, phrase)
    await expect(body).toContainText(sentinel)
    const marker = await page.evaluate(() => {
      const value = crypto.randomUUID()
      Object.assign(window, {releaseDocumentMarker: value})
      return value
    })
    await context.setOffline(false)
    await expect(
      page.getByRole('status').filter({hasText: e.synced}),
    ).toBeVisible({timeout: 30_000})
    expect(
      await page.evaluate(
        () =>
          (window as unknown as {releaseDocumentMarker: string})
            .releaseDocumentMarker,
      ),
    ).toBe(marker)
    await expect(body).toContainText(sentinel)
    expect(await noteApp.all()).toHaveLength(1)

    await page.getByRole('button', {name: v.lock, exact: true}).click()
    await context.setOffline(true)
    const cold = await context.newPage()
    try {
      // Protected navigations are deliberately NetworkOnly, including a cold
      // offline launch. Only an already loaded, authenticated shell can edit.
      await expect(cold.goto('/en/collection/encrypted')).rejects.toThrow()
    } finally {
      await cold.close()
    }
    await context.setOffline(false)
    await page.reload()
    await unlock(page, phrase)
    await page
      .getByRole('button', {name: /Browser version/})
      .first()
      .click()
    await expect(body).toContainText(sentinel)
  } finally {
    await context.setOffline(false)
  }
})

test('synthetic secrets stay out of network, SSR, browser persistence, caches and server plaintext projections with the worker active', async ({
  page,
  context,
  noteApp,
}) => {
  test.setTimeout(120_000)
  const network: string[] = []
  const consoleOutput: string[] = []
  context.on('request', (request) =>
    network.push(`${request.url()} ${request.postData() ?? ''}`),
  )
  page.on('console', (message) => consoleOutput.push(message.text()))
  page.on('pageerror', (error) => consoleOutput.push(error.message))
  const {phrase, recovery} = await activateVault(page)
  await page.getByRole('button', {name: n.create, exact: true}).click()
  const sentinel = `BOUNDARY-${randomUUID()}`
  await page.getByRole('textbox', {name: e.title, exact: true}).fill(sentinel)
  await page
    .getByRole('textbox', {name: e.body, exact: true})
    .fill(`Private body ${sentinel}`)
  const sent = page.waitForRequest(
    (request) =>
      request.method() === 'PUT' &&
      request.url().includes('/api/note-encryption/'),
  )
  await page.getByRole('button', {name: e.save, exact: true}).click()
  const noteId = new URL((await sent).url()).pathname.split('/').at(-1)!
  await expect(
    page.getByRole('status').filter({hasText: e.synced}),
  ).toBeVisible()
  const persistent = await page.evaluate(async () => {
    const stores: unknown[] = []
    for (const {name} of await indexedDB.databases()) {
      if (!name?.startsWith('etoN-')) continue
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        for (const store of db.objectStoreNames)
          stores.push(
            await new Promise((resolve, reject) => {
              const request = db.transaction(store).objectStore(store).getAll()
              request.onsuccess = () => resolve(request.result)
              request.onerror = () => reject(request.error)
            }),
          )
      } finally {
        db.close()
      }
    }
    return JSON.stringify([stores, {...localStorage}, {...sessionStorage}])
  })
  const client = postgres(process.env.DATABASE_URL!, {max: 1})
  let server: string
  try {
    const rows =
      await client`SELECT title, content, encrypted_payload FROM notes WHERE id = ${noteId} AND author_id = ${noteApp.ownerId}`
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBeNull()
    expect(rows[0].content).toBeNull()
    const search =
      await client`SELECT * FROM note_search_documents WHERE note_id = ${noteId}`
    expect(search.every((row) => !JSON.stringify(row).includes(sentinel))).toBe(
      true,
    )
    server = JSON.stringify([
      rows,
      search,
      await client`SELECT * FROM note_vaults WHERE owner_id = ${noteApp.ownerId}`,
    ])
  } finally {
    await client.end()
  }
  await page.getByRole('button', {name: v.lock, exact: true}).click()
  const ssr: string[] = []
  for (const path of ['/en/collection/encrypted', `/en/full/eton/${noteId}`]) {
    const response = await context.request.get(path)
    expect(response.ok()).toBe(true)
    ssr.push(await response.text())
    const rsc = await context.request.get(path, {headers: {RSC: '1'}})
    expect(rsc.ok()).toBe(true)
    ssr.push(await rsc.text())
  }
  const caches = JSON.stringify(await cacheContents(page))
  for (const secret of [sentinel, phrase, recovery])
    for (const surface of [
      network.join('\n'),
      consoleOutput.join('\n'),
      persistent,
      server!,
      ssr.join('\n'),
      caches,
    ])
      expect(surface).not.toContain(secret)
})

test('production worker activation purges old private cache keys while retaining public assets', async ({
  page,
  noteApp,
}) => {
  void noteApp
  await page.goto('/robots.txt')
  const result = await page.evaluate(async () => {
    const privatePaths = [
      '/en/eton/old.html',
      '/vi/collection/encrypted.rsc',
      '/api/note-encryption/old',
      '/api/note-vault',
      '/api/auth/session',
      '/en/settings/account',
    ]
    const cache = await caches.open('release-legacy-cache')
    for (const path of [...privatePaths, '/public-release-asset.txt'])
      await cache.put(path, new Response('SYNTHETIC-LEGACY-CACHE'))
    await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => resolve(),
          {once: true},
        ),
      )
    // clientsClaim occurs during activation; wait for its waitUntil cleanup.
    for (let attempt = 0; attempt < 100; attempt++) {
      if ((await cache.keys()).length === 1) break
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    return (await cache.keys()).map((request) => new URL(request.url).pathname)
  })
  expect(result).toEqual(['/public-release-asset.txt'])
})
