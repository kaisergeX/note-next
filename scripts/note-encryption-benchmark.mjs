import assert from 'node:assert/strict'
import {writeFile, mkdir} from 'node:fs/promises'
import {cpus, release, platform, totalmem} from 'node:os'
import {build} from 'esbuild'
import {chromium} from '@playwright/test'

const origin = new URL(process.env.NOTES_TEST_ORIGIN)
assert.ok(
  origin.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(origin.hostname),
)
const bundle = await build({
  stdin: {
    contents: `
    export * from './lib/notes/encryption/crypto'
    export * from './lib/notes/encryption/storage'
    export * from './lib/notes/encryption/recovery'
    export {prepareEncryptedWrite} from './lib/notes/encryption/sync'
    export {sanitizeNoteHtml} from './lib/notes/html'
  `,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  globalName: 'encryptionBenchmark',
})
const browser = await chromium.launch()
try {
  const context = await browser.newContext({serviceWorkers: 'block'})
  const forceFallback = process.argv.includes('--fallback')
  if (forceFallback)
    await context.addInitScript(() => {
      delete Uint8Array.prototype.toBase64
      delete Uint8Array.fromBase64
    })
  const page = await context.newPage()
  await page.goto(`${origin.origin}/robots.txt`)
  await page.addScriptTag({content: bundle.outputFiles[0].text})
  const results = await page.evaluate(async () => {
    const b = window.encryptionBenchmark
    const uuid = () => crypto.randomUUID()
    const ownerId = uuid(),
      vaultId = uuid(),
      noteId = uuid()
    const raw = b.generateRoot(),
      root = await b.importRoot(raw)
    const timings = {}
    const longTasks = []
    const observer = new PerformanceObserver((list) =>
      longTasks.push(
        ...list
          .getEntries()
          .map((entry) => ({start: entry.startTime, duration: entry.duration})),
      ),
    )
    observer.observe({type: 'longtask'})
    async function measure(name, action) {
      const phaseStart = performance.now()
      const samples = []
      for (let i = 0; i < 31; i++) {
        const start = performance.now()
        await action(i)
        samples.push(performance.now() - start)
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      const cold = samples.shift()
      samples.sort((a, b) => a - b)
      const phaseEnd = performance.now()
      await new Promise((resolve) => setTimeout(resolve, 50))
      const tasks = longTasks.filter(
        (task) => task.start >= phaseStart && task.start < phaseEnd,
      )
      timings[name] = {
        runs: samples.length,
        firstMs: cold,
        p50Ms: samples[14],
        p95Ms: samples[28],
        maxMs: samples[29],
        longTasks: {
          count: tasks.length,
          maxMs: Math.max(0, ...tasks.map((task) => task.duration)),
        },
      }
    }
    const route = {
      ownerId,
      vaultId,
      stableNoteId: noteId,
      recordId: uuid(),
      generation: 0,
      capturedEpoch: 0,
      mode: 'encrypted',
      noteId,
      creationId: noteId,
      sourceNoteId: null,
      sourceEpoch: null,
      flightDestination: null,
      mutationId: null,
      expectedRevision: null,
    }
    await b.initializeEncryptedNote(ownerId, noteId)
    const sizes = {}
    let largest
    for (const [label, content] of [
      [
        'normal32KiB',
        {
          title: '<p>Synthetic benchmark</p>',
          content: '<p>' + 'a'.repeat(32 * 1024 - 50) + '</p>',
          theme: null,
        },
      ],
      [
        'maxUnicode',
        {
          title: '<p>' + '\u0800'.repeat(758) + '</p>',
          content: '<p>' + '\u0800'.repeat(262137) + '</p>',
          theme: null,
        },
      ],
      [
        'maxJsonExpansion',
        {
          title: '\u0000'.repeat(765),
          content: '\u0000'.repeat(173995),
          theme: null,
        },
      ],
    ]) {
      const payload = await b.sealNote(
        root,
        ownerId,
        {vaultId, noteId, contentId: uuid()},
        content,
      )
      const request = b.prepareEncryptedWrite(payload, uuid(), null)
      const flight = {
        destination: noteId,
        mutationId: JSON.parse(request).mutationId,
        expectedRevision: JSON.parse(request).expectedRevision,
        request,
      }
      const record = {
        version: 1,
        route: {
          ...route,
          recordId: uuid(),
          flightDestination: noteId,
          mutationId: flight.mutationId,
          expectedRevision: flight.expectedRevision,
        },
        baseline: {...content},
        baselineVerified: true,
        draft: {...content},
        conflict: {...content},
        conflictRevision: uuid(),
        flight,
        resolution: null,
      }
      b.validateRecoveryPayload(record, record.route)
      sizes[label] = {
        contentObjectJsonBytes: new TextEncoder().encode(
          JSON.stringify(content),
        ).length,
        wireBytes: new TextEncoder().encode(request).length,
        conflictDecodedBytes: new TextEncoder().encode(JSON.stringify(record))
          .length,
      }
      await measure(`${label}.noteSeal`, () =>
        b.sealNote(
          root,
          ownerId,
          {vaultId, noteId, contentId: uuid()},
          content,
        ),
      )
      await measure(`${label}.detailOpenValidateSanitize`, async () => {
        const opened = await b.openNote(root, ownerId, payload, {
          vaultId,
          noteId,
        })
        b.sanitizeNoteHtml(opened.title)
        b.sanitizeNoteHtml(opened.content)
      })
      await measure(`${label}.conflictSealCommit`, async () => {
        record.route.generation++
        const committed = await b.putEncryptedRecovery(root, record, {
          updatedAt: Date.now(),
          status: 'conflict',
          versionId: uuid(),
        })
        if (!committed) throw Error('Checkpoint was refused')
      })
      const envelope = await b.sealRecovery(root, record.route, record)
      sizes[label].conflictEncodedBytes = new TextEncoder().encode(
        JSON.stringify(envelope),
      ).length
      if (label === 'maxJsonExpansion') largest = {record, envelope}
    }
    // The recovery schema also accepts a locally edited snapshot that cannot
    // fit the wire budget. Preserve its worst JSON expansion without truncation.
    const localMax = structuredClone(largest.record)
    localMax.route.recordId = uuid()
    localMax.route.generation = 0
    for (const field of ['baseline', 'draft', 'conflict'])
      localMax[field] = {
        title: '\u0000'.repeat(765),
        content: '\u0000'.repeat(262144),
        theme: null,
      }
    b.validateRecoveryPayload(localMax, localMax.route)
    await measure('schemaMaxRecovery.conflictSealCommit', async () => {
      localMax.route.generation++
      if (
        !(await b.putEncryptedRecovery(root, localMax, {
          updatedAt: Date.now(),
          status: 'conflict',
          versionId: uuid(),
        }))
      )
        throw Error('Schema maximum checkpoint was refused')
    })
    const localEnvelope = await b.sealRecovery(root, localMax.route, localMax)
    sizes.schemaMaxRecovery = {
      conflictDecodedBytes: new TextEncoder().encode(JSON.stringify(localMax))
        .length,
      conflictEncodedBytes: new TextEncoder().encode(
        JSON.stringify(localEnvelope),
      ).length,
    }
    largest = {record: localMax, envelope: localEnvelope}
    // Fresh synthetic owner: 1,000 headers and 20 independently sealed maximum
    // supported conflict records. No real accounts or notes are read or written.
    const scanOwner = uuid()
    const db = await new Promise((resolve, reject) => {
      const open = indexedDB.open('etoN-encrypted-note-recovery')
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    const headers = [],
      sealed = []
    for (let i = 0; i < 1000; i++) {
      const id = uuid()
      const route = {
        ...largest.record.route,
        ownerId: scanOwner,
        recordId: id,
        generation: i + 1,
      }
      let envelope
      if (i < 20) {
        const record = structuredClone(largest.record)
        record.route = route
        record.draft.title = '<p>Distinct retained ' + i + '</p>'
        envelope = await b.sealRecovery(root, record.route, record)
        sealed.push({id, ownerId: scanOwner, envelope})
      }
      headers.push({
        ...route,
        id,
        updatedAt: i,
        status: 'retained',
        versionId: uuid(),
        encodedBytes: envelope
          ? new TextEncoder().encode(JSON.stringify(envelope)).length
          : 0,
      })
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['headers', 'payloads'], 'readwrite')
      for (const h of headers) tx.objectStore('headers').put(h)
      for (const p of sealed) tx.objectStore('payloads').put(p)
      tx.oncomplete = resolve
      tx.onabort = () => reject(tx.error)
    })
    const titleHeaders = []
    for (let i = 0; i < 50; i++) {
      const id = uuid()
      const payload = await b.sealNote(
        root,
        ownerId,
        {vaultId, noteId: id, contentId: uuid()},
        {title: '<p>Visible header ' + i + '</p>', content: null},
      )
      titleHeaders.push({
        vaultId,
        noteId: id,
        contentId: payload.contentId,
        title: payload.title,
      })
    }
    const reads = {payloads: 0, kdfs: 0, detailFetches: 0}
    const originalTransaction = IDBDatabase.prototype.transaction
    IDBDatabase.prototype.transaction = function (names, ...args) {
      if (
        (typeof names === 'string' ? [names] : Array.from(names)).includes(
          'payloads',
        )
      )
        reads.payloads++
      return originalTransaction.call(this, names, ...args)
    }
    const originalDerive = SubtleCrypto.prototype.deriveKey
    SubtleCrypto.prototype.deriveKey = function (algorithm, ...args) {
      if (algorithm.name === 'PBKDF2') reads.kdfs++
      return originalDerive.call(this, algorithm, ...args)
    }
    const originalFetch = window.fetch
    window.fetch = function (...args) {
      reads.detailFetches++
      return originalFetch.apply(this, args)
    }
    try {
      await measure('headers1000.page50', async () => {
        if ((await b.listEncryptedRecovery(scanOwner)).length !== 50)
          throw Error('Page limit failed')
      })
      await measure('headers1000.fullPaginatedScan', async () => {
        let count = 0
        for (let offset = 0; offset < 1000; offset += 50)
          count += (await b.listEncryptedRecovery(scanOwner, offset)).length
        if (count !== 1000) throw Error('Incomplete scan')
      })
      await measure('headers.visiblePage50TitleDecrypt', () =>
        Promise.all(
          titleHeaders.map((header) =>
            b.openNoteTitle(root, ownerId, header, {
              vaultId,
              noteId: header.noteId,
            }),
          ),
        ),
      )
    } finally {
      IDBDatabase.prototype.transaction = originalTransaction
      SubtleCrypto.prototype.deriveKey = originalDerive
      window.fetch = originalFetch
      db.close()
    }
    const passphrase =
      'Synthetic generated benchmark credential with no real notes'
    const wrapper = await b.wrapRoot(
      raw,
      {
        ownerId,
        vaultId,
        wrapperId: uuid(),
        purpose: 'passphrase',
        profileId: 'pbkdf2-sha256-600000',
        passkeyBinding: null,
        salt: b.generatePassphraseSalt(),
      },
      passphrase,
    )
    await measure('pbkdf2Unlock600000', () => b.unwrapRoot(wrapper, passphrase))
    raw.fill(0)
    await new Promise((resolve) => setTimeout(resolve, 50))
    observer.disconnect()
    await b.clearEncryptedAccountStorage(ownerId)
    await b.clearEncryptedAccountStorage(scanOwner)
    return {
      userAgent: navigator.userAgent,
      nativeCodecs: {
        encode: typeof Uint8Array.prototype.toBase64 === 'function',
        decode: typeof Uint8Array.fromBase64 === 'function',
      },
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      timings,
      sizes,
      reads,
      retainedRecords: sealed.length,
      retainedEncodedBytes: headers.reduce((sum, h) => sum + h.encodedBytes, 0),
      longTasksIncludingFixtureSetup: {
        count: longTasks.length,
        maxMs: Math.max(0, ...longTasks.map((task) => task.duration)),
      },
      storage: await navigator.storage.estimate(),
    }
  })
  const report = {
    date: new Date().toISOString(),
    environment: {
      platform: platform(),
      osRelease: release(),
      cpu: cpus()[0].model,
      logicalCpus: cpus().length,
      memoryGiB: Math.round(totalmem() / 1024 ** 3),
      browser: browser.version(),
      cold: 'first operation after setup, not browser/process cold',
      warm: '30 subsequent sequential runs, no CPU throttling',
    },
    ...results,
  }
  await mkdir('.playwright-mcp', {recursive: true})
  await writeFile(
    forceFallback
      ? '.playwright-mcp/release-benchmark-fallback.json'
      : '.playwright-mcp/release-benchmark.json',
    JSON.stringify(report, null, 2) + '\n',
  )
  console.log(JSON.stringify(report, null, 2))
  assert.deepEqual(results.reads, {payloads: 0, kdfs: 0, detailFetches: 0})
} finally {
  await browser.close()
}
