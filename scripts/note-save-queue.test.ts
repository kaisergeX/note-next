import assert from 'node:assert/strict'
import {test, type TestContext} from 'node:test'
import type {Note} from '../db/schema/notes'
import {
  NoteSyncSession,
  pauseAccountDrafts,
  type NoteSyncDependencies,
} from '../lib/notes/session-sync'
import type {RecoveryDraft} from '../lib/notes/drafts'
import {usePersistStore} from '../store'
import type {SyncRequest, SyncResult} from '../lib/notes/sync'

function setup(t: TestContext, send: NoteSyncDependencies['send']) {
  t.mock.timers.enable({apis: ['Date', 'setTimeout'], now: 100000})
  const previousWindow = globalThis.window
  Object.defineProperty(globalThis, 'window', {
    value: new EventTarget(),
    configurable: true,
  })
  t.after(() =>
    Object.defineProperty(globalThis, 'window', {
      value: previousWindow,
      configurable: true,
    }),
  )
  const baseline: Note = {
    id: crypto.randomUUID(),
    authorId: crypto.randomUUID(),
    revision: crypto.randomUUID(),
    lastMutationId: null,
    title: 'Title',
    content: 'Body',
    theme: null,
    pendingDeleteAt: null,
    isArchived: false,
    isEncrypted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  usePersistStore.persist.setOptions({
    storage: {getItem: () => null, setItem: () => {}, removeItem: () => {}},
  })
  usePersistStore.getState().resetNoteStore()
  usePersistStore.getState().beginNoteSession('queue-test', baseline)
  const records = new Map<string, RecoveryDraft>()
  let writes = 0
  const io: NoteSyncDependencies = {
    list: async () => [...records.values()],
    put: async (record) => {
      writes++
      records.set(record.id, structuredClone(record))
    },
    clear: async (id, generation) => {
      if ((records.get(id)?.generation ?? Infinity) <= generation)
        records.delete(id)
    },
    send,
    read: async () => ({status: 'success', note: baseline}),
  }
  const controller = new NoteSyncSession(
    baseline.authorId,
    usePersistStore.getState().noteSession!,
    baseline,
    io,
  )
  t.after(() => {
    controller.stop()
    usePersistStore.getState().resetNoteStore()
  })
  return {controller, baseline, records, io, writes: () => writes}
}
const settle = async () => {
  for (let n = 0; n < 30; n++) await Promise.resolve()
}

test('bulk Trash notification retains memory-only work when the local checkpoint fails', async (t) => {
  const context = setup(t, async () => ({status: 'retryable_error'}))
  await context.controller.hydrate()
  const put = context.io.put
  context.io.put = async () => {
    throw new Error('Storage unavailable')
  }
  usePersistStore
    .getState()
    .setMutateNoteData({content: 'Keep memory-only edits'})
  assert.equal(await pauseAccountDrafts(context.baseline.authorId), false)
  assert.equal(
    usePersistStore.getState().mutateNoteData?.content,
    'Keep memory-only edits',
  )
  context.io.put = put
  assert.equal(await pauseAccountDrafts(context.baseline.authorId), true)
  assert.equal(usePersistStore.getState().mutateNoteData, undefined)
  assert.equal(
    context.records.get(context.controller.record.id)?.draft.content,
    'Keep memory-only edits',
  )
})

test('bulk Trash notification preserves edits made during the local checkpoint', async (t) => {
  const context = setup(t, async () => ({status: 'retryable_error'}))
  await context.controller.hydrate()
  const put = context.io.put
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  context.io.put = async (record) => {
    await pending
    await put(record)
  }
  usePersistStore.getState().setMutateNoteData({content: 'First edit'})
  const pause = pauseAccountDrafts(context.baseline.authorId)
  await settle()
  usePersistStore.getState().setMutateNoteData({content: 'Newer edit'})
  release()
  assert.equal(await pause, false)
  assert.equal(usePersistStore.getState().mutateNoteData?.content, 'Newer edit')
  context.io.put = put
  assert.equal(await pauseAccountDrafts(context.baseline.authorId), true)
  assert.equal(
    context.records.get(context.controller.record.id)?.draft.content,
    'Newer edit',
  )
})

test('open-only session has no local writes or server attempts and no idle polling', async (t) => {
  let attempts = 0
  const context = setup(t, async () => {
    attempts++
    return {status: 'retryable_error'}
  })
  await context.controller.hydrate()
  t.mock.timers.tick(120000)
  await settle()
  assert.equal(attempts, 0)
  assert.equal(context.writes(), 0)
})

test('local debounce and server pause use separate budgets; sustained typing reaches max wait', async (t) => {
  let attempts = 0
  const context = setup(t, async () => {
    attempts++
    return {status: 'retryable_error'}
  })
  await context.controller.hydrate()
  usePersistStore.getState().setMutateNoteData({content: 'A'})
  t.mock.timers.tick(499)
  await settle()
  assert.equal(context.writes(), 0)
  t.mock.timers.tick(1)
  await settle()
  assert.ok(context.writes() > 0)
  for (let n = 0; n < 29; n++) {
    usePersistStore.getState().setMutateNoteData({content: `Typing ${n}`})
    t.mock.timers.tick(1000)
    await settle()
  }
  assert.equal(attempts, 0)
  t.mock.timers.tick(500)
  await settle()
  assert.equal(attempts, 1)
})

test('edits during a request survive its acknowledgement and keep durable recovery', async (t) => {
  let complete!: (result: SyncResult) => void
  let sent!: SyncRequest
  const context = setup(t, (request) => {
    sent = structuredClone(request)
    return new Promise((resolve) => {
      complete = resolve
    })
  })
  await context.controller.hydrate()
  usePersistStore.getState().setMutateNoteData({content: 'Submitted'})
  const saving = context.controller.flush('save', true)
  await settle()
  usePersistStore.getState().setMutateNoteData({content: 'Typed while saving'})
  complete({
    status: 'success',
    note: {...context.baseline, ...sent.content, revision: crypto.randomUUID()},
  })
  await saving
  assert.equal(
    usePersistStore.getState().mutateNoteData?.content,
    'Typed while saving',
  )
  assert.equal(context.controller.record.baseline.content, 'Submitted')
  assert.equal(
    context.records.get(context.controller.record.id)?.draft.content,
    'Typed while saving',
  )
  assert.equal(context.controller.dirty, true)
})

test('lost-response retry uses the exact mutation identity and snapshot before newer edits', async (t) => {
  const requests: SyncRequest[] = []
  const context = setup(t, async (request) => {
    requests.push(structuredClone(request))
    return {status: 'retryable_error'}
  })
  await context.controller.hydrate()
  usePersistStore.getState().setMutateNoteData({content: 'First attempt'})
  await context.controller.flush('save', true)
  usePersistStore.getState().setMutateNoteData({content: 'Newer edits'})
  await context.controller.retry()
  assert.equal(requests.length, 2)
  assert.deepEqual(requests[1], requests[0])
  assert.equal(context.controller.record.draft.content, 'Newer edits')
})

test('failure allows leaving after durable local storage', async (t) => {
  const context = setup(t, async () => ({status: 'retryable_error'}))
  await context.controller.hydrate()
  usePersistStore.getState().setMutateNoteData({content: 'Keep this'})
  let left = false
  await context.controller.leave('save', () => {
    left = true
  })
  assert.equal(left, true)
  assert.equal(
    context.records.get(context.controller.record.id)?.draft.content,
    'Keep this',
  )
})

test('combined server and storage failures keep the editor and announce the failure', async (t) => {
  const context = setup(t, async () => ({status: 'retryable_error'}))
  context.io.put = async () => {
    throw new Error('Storage unavailable')
  }
  await context.controller.hydrate()
  usePersistStore.getState().setMutateNoteData({content: 'Keep this in memory'})
  let left = false
  await context.controller.leave('save', () => {
    left = true
  })
  assert.equal(left, false)
  assert.equal(usePersistStore.getState().noteSession?.storageFailed, true)
  assert.equal(usePersistStore.getState().noteSession?.error, 'save')
  assert.equal(
    usePersistStore.getState().mutateNoteData?.content,
    'Keep this in memory',
  )
})

test('permanent errors stop scheduled retries while preserving the recovery record', async (t) => {
  let attempts = 0
  const context = setup(t, async () => {
    attempts++
    return {status: 'unauthenticated'}
  })
  await context.controller.hydrate()
  usePersistStore.getState().setMutateNoteData({content: 'Unsynced'})
  await context.controller.flush('save', true)
  t.mock.timers.tick(120000)
  await settle()
  assert.equal(attempts, 1)
  assert.equal(context.controller.blocked, true)
  assert.ok(context.records.has(context.controller.record.id))
})

test('reopening review fetches the latest saved version and preserves local edits', async (t) => {
  const context = setup(t, async () => ({
    status: 'conflict',
    note: {
      ...context.baseline,
      revision: crypto.randomUUID(),
      content: 'Saved version one',
    },
  }))
  await context.controller.hydrate()
  usePersistStore.getState().setMutateNoteData({content: 'My current changes'})
  await context.controller.flush('save', true)
  let reads = 0
  context.io.read = async () => {
    reads++
    return {
      status: 'success',
      note: {
        ...context.baseline,
        revision: crypto.randomUUID(),
        title: `Remote title ${reads}`,
        content: `Saved version ${reads + 1}`,
      },
    }
  }
  await context.controller.refreshRemote('review')
  assert.equal(context.controller.record.conflict?.content, 'Saved version 2')
  assert.equal(context.controller.record.draft.content, 'My current changes')
  assert.equal(context.controller.record.draft.title, 'Remote title 1')
  await context.controller.refreshRemote('review')
  assert.equal(context.controller.record.conflict?.content, 'Saved version 3')
  t.mock.timers.tick(120000)
  await settle()
  assert.equal(reads, 2, 'Review freshness must not become idle polling')
})

test('visibility refresh updates a clean editor without making a server write', async (t) => {
  let writes = 0
  const context = setup(t, async () => {
    writes++
    return {status: 'retryable_error'}
  })
  await context.controller.hydrate()
  const latest = {
    ...context.baseline,
    revision: crypto.randomUUID(),
    content: 'Changed on another device',
  }
  context.io.read = async () => ({status: 'success', note: latest})
  assert.equal(await context.controller.refreshRemote(), true)
  assert.equal(
    usePersistStore.getState().mutateNoteData?.content,
    latest.content,
  )
  assert.equal(context.controller.record.baseline.revision, latest.revision)
  assert.equal(context.controller.dirty, false)
  assert.equal(writes, 0)
})

test('visibility refresh reconciles independent fields while retaining pending local work', async (t) => {
  const context = setup(t, async () => ({status: 'retryable_error'}))
  await context.controller.hydrate()
  usePersistStore.getState().setMutateNoteData({content: 'Local body'})
  context.io.read = async () => ({
    status: 'success',
    note: {
      ...context.baseline,
      revision: crypto.randomUUID(),
      title: 'Remote title',
    },
  })
  await context.controller.refreshRemote()
  assert.equal(context.controller.record.draft.content, 'Local body')
  assert.equal(context.controller.record.draft.title, 'Remote title')
  assert.equal(context.controller.record.conflict, undefined)
  assert.equal(context.controller.dirty, true)
})

test('edits made during a visibility read survive and cause review for same-field changes', async (t) => {
  let finish!: (result: SyncResult) => void
  const context = setup(t, async () => ({status: 'retryable_error'}))
  await context.controller.hydrate()
  context.io.read = () =>
    new Promise((resolve) => {
      finish = resolve
    })
  const reading = context.controller.refreshRemote()
  usePersistStore
    .getState()
    .setMutateNoteData({content: 'Typed while checking'})
  finish({
    status: 'success',
    note: {
      ...context.baseline,
      revision: crypto.randomUUID(),
      content: 'Remote body',
    },
  })
  await reading
  assert.equal(context.controller.record.draft.content, 'Typed while checking')
  assert.equal(context.controller.record.conflict?.content, 'Remote body')
})

test('remote Trash discovered on visibility stops writes and retains the local recovery draft', async (t) => {
  let writes = 0
  const context = setup(t, async () => {
    writes++
    return {status: 'retryable_error'}
  })
  await context.controller.hydrate()
  usePersistStore.getState().setMutateNoteData({content: 'Recover this'})
  context.io.read = async () => ({status: 'unavailable'})
  await context.controller.refreshRemote()
  await context.controller.retry()
  assert.equal(writes, 0)
  assert.equal(context.controller.record.unavailable, true)
  assert.equal(
    context.records.get(context.controller.record.id)?.draft.content,
    'Recover this',
  )
})

test('failed review refresh keeps both cached content and local work and can retry', async (t) => {
  const context = setup(t, async () => ({
    status: 'conflict',
    note: {
      ...context.baseline,
      revision: crypto.randomUUID(),
      content: 'Remote one',
    },
  }))
  await context.controller.hydrate()
  usePersistStore.getState().setMutateNoteData({content: 'Mine'})
  await context.controller.flush('save', true)
  context.io.read = async () => ({status: 'retryable_error'})
  assert.equal(await context.controller.refreshRemote('review'), false)
  assert.equal(context.controller.record.conflict?.content, 'Remote one')
  assert.equal(context.controller.record.draft.content, 'Mine')
  assert.equal(usePersistStore.getState().noteSession?.remoteCheckFailed, true)
  context.io.read = async () => ({
    status: 'success',
    note: {
      ...context.baseline,
      revision: crypto.randomUUID(),
      content: 'Remote two',
    },
  })
  assert.equal(await context.controller.refreshRemote('review'), true)
  assert.equal(context.controller.record.conflict?.content, 'Remote two')
  assert.equal(usePersistStore.getState().noteSession?.remoteCheckFailed, false)
})

test('visibility read can acknowledge an exact committed save with a lost response', async (t) => {
  let sent!: SyncRequest
  const context = setup(t, async (request) => {
    sent = structuredClone(request)
    return {status: 'retryable_error'}
  })
  await context.controller.hydrate()
  usePersistStore.getState().setMutateNoteData({content: 'Committed body'})
  await context.controller.flush('save', true)
  context.io.read = async () => ({
    status: 'success',
    note: {
      ...context.baseline,
      ...sent.content,
      lastMutationId: sent.mutationId,
      revision: crypto.randomUUID(),
    },
  })
  await context.controller.refreshRemote()
  assert.equal(context.controller.record.flight, undefined)
  assert.equal(context.controller.dirty, false)
  assert.equal(context.records.has(context.controller.record.id), false)
  assert.equal(usePersistStore.getState().noteSession?.syncStatus, 'saved')
})
