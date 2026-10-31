import assert from 'node:assert/strict'
import {test, type TestContext} from 'node:test'
import type {Note} from '../db/schema/notes'
import {
  NoteSyncSession,
  beginNoteSync,
  getNoteSync,
  pauseAccountDrafts,
  type NoteSyncDependencies,
} from '../lib/notes/session-sync'
import type {RecoveryDraft} from '../lib/notes/drafts'
import {
  groupRecoveryDrafts,
  groupNoteRecovery,
  noteRecoveryGroups,
} from '../lib/notes/recovery-copies'
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

test('hydrating a same-field conflict preserves local HTML and independent remote changes', async (t) => {
  const {controller, baseline, records} = setup(t, async () => ({
    status: 'retryable_error',
  }))
  const recovery: RecoveryDraft = {
    ...structuredClone(controller.record),
    id: crypto.randomUUID(),
    baseline: {
      ...baseline,
      content: '<p>Earlier body</p>',
      title: 'Earlier title',
    },
    draft: {
      title: 'Earlier title',
      content: '<p><strong>My local work</strong></p>',
      theme: 'green',
    },
  }
  records.set(recovery.id, structuredClone(recovery))
  await controller.hydrate(recovery)
  assert.equal(controller.record.draft.content, recovery.draft.content)
  assert.equal(controller.record.draft.theme, 'green')
  assert.equal(controller.record.draft.title, baseline.title)
  assert.equal(controller.record.conflict?.content, baseline.content)
  assert.equal(
    usePersistStore.getState().mutateNoteData?.content,
    recovery.draft.content,
  )
  assert.equal(
    records.get(controller.record.id)?.draft.content,
    recovery.draft.content,
  )
  await controller.refreshRemote('review')
  assert.equal(controller.record.draft.content, recovery.draft.content)
  assert.equal(controller.record.draft.title, baseline.title)
})

test('explicit recovery resumes the selected draft and retains its changed theme', async (t) => {
  const {controller, baseline, records} = setup(t, async () => ({
    status: 'retryable_error',
  }))
  const recovery: RecoveryDraft = {
    ...structuredClone(controller.record),
    id: crypto.randomUUID(),
    draft: {...controller.record.draft, content: 'Unsynced draft'},
  }
  records.set(recovery.id, structuredClone(recovery))
  await controller.hydrate(recovery)
  assert.equal(records.has(recovery.id), false)
  assert.equal(records.size, 1)
  usePersistStore.getState().setMutateNoteData({theme: 'green'})
  assert.equal(await controller.persist(), true)
  assert.equal(records.get(controller.record.id)?.draft.theme, 'green')
  assert.equal(
    records.get(controller.record.id)?.draft.content,
    'Unsynced draft',
  )
  assert.equal(controller.record.noteId, baseline.id)
})

test('explicit recovery keeps the selected copy if its replacement cannot be checkpointed', async (t) => {
  const {controller, records, io} = setup(t, async () => ({
    status: 'retryable_error',
  }))
  const recovery: RecoveryDraft = {
    ...structuredClone(controller.record),
    id: crypto.randomUUID(),
    draft: {...controller.record.draft, content: 'Only durable copy'},
  }
  records.set(recovery.id, structuredClone(recovery))
  io.put = async () => {
    throw new Error('Storage unavailable')
  }
  await controller.hydrate(recovery)
  assert.deepEqual(records.get(recovery.id), recovery)
  assert.equal(records.size, 1)
  assert.equal(
    usePersistStore.getState().mutateNoteData?.content,
    'Only durable copy',
  )
})

test('explicit recovery preserves source edits arriving during its replacement checkpoint', async (t) => {
  const {controller, records, io} = setup(t, async () => ({
    status: 'retryable_error',
  }))
  const recovery: RecoveryDraft = {
    ...structuredClone(controller.record),
    id: crypto.randomUUID(),
    draft: {...controller.record.draft, content: 'Selected version'},
  }
  records.set(recovery.id, structuredClone(recovery))
  const put = io.put
  io.put = async (record) => {
    records.set(recovery.id, {
      ...recovery,
      generation: recovery.generation + 1,
      draft: {...recovery.draft, content: 'Newer work from another tab'},
    })
    await put(record)
  }
  await controller.hydrate(recovery)
  assert.equal(
    records.get(recovery.id)?.draft.content,
    'Newer work from another tab',
  )
  assert.equal(
    records.get(controller.record.id)?.draft.content,
    'Selected version',
  )
})

test('equivalent recovery copies form one card, while different work stays separate', (t) => {
  const {controller} = setup(t, async () => ({status: 'retryable_error'}))
  const original = structuredClone(controller.record)
  const duplicate = {
    ...original,
    id: crypto.randomUUID(),
    updatedAt: original.updatedAt + 1,
  }
  const edited = {
    ...duplicate,
    id: crypto.randomUUID(),
    draft: {...duplicate.draft, content: 'Other work'},
  }
  const groups = groupRecoveryDrafts([original, duplicate, edited])
  assert.equal(groups.length, 2)
  const identical = groups.find((group) => group.copies.length === 2)!
  assert.equal(identical.record.id, duplicate.id)
  assert.deepEqual(
    identical.copies.map((copy) => copy.id),
    [original.id, duplicate.id],
  )
  assert.equal(
    groupRecoveryDrafts([
      {...original, noteId: null},
      {...duplicate, noteId: null, creationId: crypto.randomUUID()},
    ]).length,
    2,
  )
  assert.equal(
    groupRecoveryDrafts([
      original,
      {...duplicate, draft: {...duplicate.draft, theme: 'green'}},
    ]).length,
    2,
  )
  assert.equal(
    groupRecoveryDrafts([
      original,
      {
        ...duplicate,
        baseline: {...duplicate.baseline, revision: crypto.randomUUID()},
      },
    ]).length,
    2,
  )
})

test('explicit recovery retires equivalent copies but keeps different work', async (t) => {
  const {controller, records} = setup(t, async () => ({
    status: 'retryable_error',
  }))
  const original: RecoveryDraft = {
    ...structuredClone(controller.record),
    id: crypto.randomUUID(),
    draft: {...controller.record.draft, content: 'Unsynced work'},
  }
  const duplicate = {...original, id: crypto.randomUUID()}
  const edited = {
    ...original,
    id: crypto.randomUUID(),
    draft: {...original.draft, content: 'Different work'},
  }
  for (const record of [original, duplicate, edited])
    records.set(record.id, record)
  await controller.hydrate(original)
  assert.equal(records.has(original.id), false)
  assert.equal(records.has(duplicate.id), false)
  assert.deepEqual(records.get(edited.id), edited)
  assert.equal(
    records.get(controller.record.id)?.draft.content,
    original.draft.content,
  )
})

test('automatic recovery preserves the other session copy', async (t) => {
  const {controller, records} = setup(t, async () => ({
    status: 'retryable_error',
  }))
  const recovery: RecoveryDraft = {
    ...structuredClone(controller.record),
    id: crypto.randomUUID(),
    draft: {...controller.record.draft, content: 'Work from another session'},
  }
  records.set(recovery.id, structuredClone(recovery))
  await controller.hydrate()
  assert.deepEqual(records.get(recovery.id), recovery)
  assert.equal(
    records.get(controller.record.id)?.draft.content,
    recovery.draft.content,
  )
})

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

test('ambiguous automatic recovery preserves every candidate without choosing by checkpoint time', async (t) => {
  const {controller, records, baseline} = setup(t, async () => ({
    status: 'retryable_error',
  }))
  const first = {
    ...structuredClone(controller.record),
    id: crypto.randomUUID(),
    draft: {...controller.record.draft, content: 'First version'},
  }
  const later = {
    ...first,
    id: crypto.randomUUID(),
    updatedAt: first.updatedAt + 1000,
    draft: {...first.draft, content: 'Later version'},
  }
  records.set(first.id, first)
  records.set(later.id, later)
  await controller.hydrate()
  assert.equal(controller.record.draft.content, baseline.content)
  assert.equal(controller.dirty, false)
  assert.deepEqual([...records.values()], [first, later])
})

test('logical identity joins a lost creation response to its saved note without joining foreign accounts', (t) => {
  const {controller, baseline} = setup(t, async () => ({
    status: 'retryable_error',
  }))
  const pending = {
    ...structuredClone(controller.record),
    id: crypto.randomUUID(),
    noteId: null,
    creationId: baseline.id,
    baseline: {},
    draft: {...controller.record.draft, content: 'Pending creation'},
  }
  const acquired = {
    ...pending,
    id: crypto.randomUUID(),
    noteId: baseline.id,
    baseline,
  }
  const foreign = {
    ...pending,
    id: crypto.randomUUID(),
    ownerId: crypto.randomUUID(),
  }
  const groups = noteRecoveryGroups(
    [pending, acquired, foreign],
    baseline.authorId,
    baseline.id,
  )
  assert.equal(groups.length, 2)
  assert.equal(groups.flatMap((group) => group.copies).length, 2)
  assert.equal(groupNoteRecovery([pending, acquired]).size, 1)
})

test('recovery acquires a known server identity while retaining its exact ambiguous creation retry', async (t) => {
  const {controller, baseline, records} = setup(t, async () => ({
    status: 'retryable_error',
  }))
  const recovery: RecoveryDraft = {
    ...structuredClone(controller.record),
    id: crypto.randomUUID(),
    noteId: null,
    creationId: baseline.id,
    baseline: {},
    flight: {
      ownerId: baseline.authorId,
      noteId: null,
      creationId: baseline.id,
      mutationId: crypto.randomUUID(),
      expectedRevision: null,
      kind: 'save',
      content: structuredClone(controller.record.draft),
    },
  }
  records.set(recovery.id, recovery)
  await controller.hydrate(recovery)
  assert.equal(controller.record.noteId, baseline.id)
  assert.deepEqual(controller.record.flight, recovery.flight)
  assert.equal(records.has(recovery.id), false)
  assert.equal(records.has(controller.record.id), true)
})

test('copies created during handoff are preserved even when equivalent to its captured source', async (t) => {
  const {controller, records, io} = setup(t, async () => ({
    status: 'retryable_error',
  }))
  const original = {
    ...structuredClone(controller.record),
    id: crypto.randomUUID(),
    draft: {...controller.record.draft, content: 'Selected work'},
  }
  const arriving = {...original, id: crypto.randomUUID()}
  records.set(original.id, original)
  const put = io.put
  io.put = async (record) => {
    records.set(arriving.id, arriving)
    await put(record)
  }
  await controller.hydrate(original)
  assert.equal(records.has(original.id), false)
  assert.deepEqual(records.get(arriving.id), arriving)
})

test('opening the saved version on the same route starts a fresh controller and retains local work', async (t) => {
  const {controller, baseline, records} = setup(t, async () => ({
    status: 'retryable_error',
  }))
  await controller.hydrate()
  usePersistStore
    .getState()
    .setMutateNoteData({content: 'Retain this local alternative'})
  assert.equal(await controller.persist(), true)
  const oldId = controller.record.id
  beginNoteSync(baseline.authorId, 'queue-test', baseline, undefined, true)
  await settle()
  const replacement = getNoteSync()!
  t.after(() => replacement.stop())
  assert.ok(replacement)
  assert.notEqual(replacement.record.id, oldId)
  assert.equal(replacement.record.draft.content, baseline.content)
  assert.equal(usePersistStore.getState().noteSession?.hydrated, true)
  assert.equal(
    records.get(oldId)?.draft.content,
    'Retain this local alternative',
  )
})

for (const status of [503, 401, 404]) {
  test(`Use saved handles HTTP ${status} without confusing a temporary failure with deletion`, async (t) => {
    const {controller, baseline} = setup(t, async () => ({
      status: 'retryable_error',
    }))
    const remote = {
      ...baseline,
      revision: crypto.randomUUID(),
      content: 'Server alternative',
    }
    const recovery = {
      ...structuredClone(controller.record),
      id: crypto.randomUUID(),
      draft: {...controller.record.draft, content: 'Local alternative'},
      conflict: remote,
    }
    await controller.hydrate(recovery)
    const shown = controller.record.conflict!.revision
    t.mock.method(globalThis, 'fetch', async () => new Response('', {status}))
    await controller.resolve('saved', shown)
    assert.equal(controller.record.draft.content, 'Local alternative')
    assert.equal(Boolean(controller.record.unavailable), status === 404)
    assert.equal(Boolean(controller.record.conflict), status !== 404)
    if (status === 503)
      assert.equal(
        usePersistStore.getState().noteSession?.remoteCheckFailed,
        true,
      )
    if (status === 401)
      assert.equal(
        usePersistStore.getState().noteSession?.syncStatus,
        'unauthenticated',
      )
  })
}

// Deliberately identical content must still represent two intentional versions.
test('Edit a copy durably preserves its source, isolates transport intent, and resumes one copy', async (t) => {
  const {controller, baseline, records, io} = setup(t, async () => ({
    status: 'retryable_error',
  }))
  await controller.hydrate()
  usePersistStore
    .getState()
    .setMutateNoteData({content: '<p>Browser source</p>', theme: 'green'})
  controller.record.conflict = {
    ...baseline,
    revision: crypto.randomUUID(),
    content: '<p>Other device</p>',
  }
  controller.record.flight = {
    ownerId: baseline.authorId,
    noteId: baseline.id,
    creationId: controller.record.creationId,
    mutationId: crypto.randomUUID(),
    expectedRevision: baseline.revision,
    content: {...controller.record.draft},
    kind: 'save',
  }
  const copy = await controller.editCopy()
  assert.ok(copy)
  assert.equal(copy.editedCopyOf, controller.record.versionId)
  assert.equal(copy.flight, undefined)
  assert.notEqual(copy.creationId, controller.record.creationId)
  assert.deepEqual(copy.draft, controller.record.draft)
  assert.equal(groupRecoveryDrafts([...records.values()]).length, 2)
  assert.equal(groupNoteRecovery([...records.values()]).size, 1)
  assert.equal(records.get(controller.record.id)?.retainedSource, true)
  assert.equal((await controller.editCopy())?.id, copy.id)
  const source = structuredClone(controller.record)
  controller.stop()
  usePersistStore.getState().resetNoteStore()
  usePersistStore.getState().beginNoteSession('copy-reload', baseline)
  const resumed = new NoteSyncSession(
    baseline.authorId,
    usePersistStore.getState().noteSession!,
    baseline,
    io,
  )
  t.after(() => resumed.stop())
  await resumed.hydrate(copy)
  assert.equal(resumed.record.versionId, copy.versionId)
  assert.equal((await resumed.editCopy())?.id, resumed.record.id)
  usePersistStore
    .getState()
    .setMutateNoteData({content: '<p>Composed copy</p>'})
  await resumed.persist()
  assert.deepEqual(records.get(source.id), source)
  assert.equal(groupRecoveryDrafts([...records.values()]).length, 2)
  assert.equal(
    records.get(resumed.record.id)?.draft.content,
    '<p>Composed copy</p>',
  )
})

test('Edit a copy does not switch away from its source when browser storage fails', async (t) => {
  const {controller, baseline, records, io} = setup(t, async () => ({
    status: 'retryable_error',
  }))
  await controller.hydrate()
  controller.record.conflict = {...baseline, revision: crypto.randomUUID()}
  usePersistStore.getState().setMutateNoteData({content: 'Durable source'})
  await controller.persist()
  const put = io.put
  io.put = async (record) => {
    if (record.editedCopyOf) throw new Error('Storage full')
    return put(record)
  }
  assert.equal(await controller.editCopy(), undefined)
  assert.equal(records.size, 1)
  assert.equal(
    records.get(controller.record.id)?.draft.content,
    'Durable source',
  )
  assert.equal(usePersistStore.getState().noteSession?.storageFailed, true)
})

test('edited copies preserve composition on fresh reads and stale saves, then retain the source after resolution', async (t) => {
  const requests: SyncRequest[] = []
  const {controller, baseline, records, io} = setup(t, async (request) => {
    requests.push(structuredClone(request))
    return {
      status: 'success',
      note: {...baseline, ...request.content, revision: crypto.randomUUID()},
    }
  })
  await controller.hydrate()
  usePersistStore
    .getState()
    .setMutateNoteData({content: 'Original browser version'})
  controller.record.conflict = {...baseline, revision: crypto.randomUUID()}
  const copy = await controller.editCopy()
  assert.ok(copy)
  const source = structuredClone(controller.record)
  controller.stop()
  usePersistStore.getState().resetNoteStore()
  usePersistStore.getState().beginNoteSession('edited-resolution', baseline)
  const edited = new NoteSyncSession(
    baseline.authorId,
    usePersistStore.getState().noteSession!,
    baseline,
    io,
  )
  t.after(() => edited.stop())
  await edited.hydrate(copy)
  usePersistStore.getState().setMutateNoteData({
    content: '<p>Manually composed</p>',
    title: '<p>Own title</p>',
  })
  const remote = {
    ...baseline,
    title: '<p>New remote title</p>',
    revision: crypto.randomUUID(),
  }
  io.read = async () => ({status: 'success', note: remote})
  await edited.refreshRemote('visibility')
  assert.equal(edited.record.draft.title, '<p>Own title</p>')
  assert.equal(edited.record.draft.content, '<p>Manually composed</p>')
  await edited.resolve('mine', baseline.revision)
  assert.equal(requests.length, 0)
  const newer = {
    ...remote,
    revision: crypto.randomUUID(),
    content: 'Changed again',
  }
  io.send = async (request) => {
    requests.push(structuredClone(request))
    return {status: 'conflict', note: newer}
  }
  await edited.resolve('mine', remote.revision)
  assert.equal(edited.record.conflict?.revision, newer.revision)
  assert.equal(edited.record.draft.content, '<p>Manually composed</p>')
  io.send = async (request) => {
    requests.push(structuredClone(request))
    return {
      status: 'success',
      note: {...newer, ...request.content, revision: crypto.randomUUID()},
    }
  }
  await edited.resolve('mine', newer.revision)
  assert.equal(edited.record.conflict, undefined)
  assert.equal(requests.at(-1)?.expectedRevision, newer.revision)
  assert.deepEqual(records.get(source.id), source)
  assert.equal(records.has(edited.record.id), false)
})

test('retained sources survive equivalent saved content and cannot group across accounts', async (t) => {
  const {controller, baseline, records} = setup(t, async () => ({
    status: 'retryable_error',
  }))
  const source: RecoveryDraft = {
    ...structuredClone(controller.record),
    id: crypto.randomUUID(),
    versionId: crypto.randomUUID(),
    retainedSource: true,
  }
  records.set(source.id, source)
  await controller.hydrate(source)
  await controller.persist()
  assert.equal(controller.record.conflict?.revision, baseline.revision)
  assert.equal(records.get(controller.record.id)?.retainedSource, true)
  const foreign = {
    ...structuredClone(controller.record),
    ownerId: crypto.randomUUID(),
  }
  assert.equal(groupRecoveryDrafts([controller.record, foreign]).length, 2)
  assert.equal(
    noteRecoveryGroups([foreign], baseline.authorId, baseline.id).length,
    0,
  )
})

test('Keep both from a retained source leaves that source attached to the original note', async (t) => {
  const {controller, baseline, records} = setup(t, async (request) => ({
    status: 'success',
    note: {
      ...baseline,
      ...request.content,
      id: request.creationId,
      revision: crypto.randomUUID(),
    },
  }))
  await controller.hydrate()
  usePersistStore
    .getState()
    .setMutateNoteData({content: '<p>Retained browser source</p>'})
  controller.record.conflict = {...baseline, revision: crypto.randomUUID()}
  await controller.editCopy()
  const sourceVersionId = controller.record.versionId
  await controller.resolve('both')
  assert.notEqual(controller.record.noteId, baseline.id)
  const retained = [...records.values()].find(
    (row) => row.versionId === sourceVersionId,
  )
  assert.ok(retained)
  assert.equal(retained.noteId, baseline.id)
  assert.equal(retained.retainedSource, true)
  assert.equal(retained.draft.content, '<p>Retained browser source</p>')
})

test('confirmed Use saved explicitly discards a retained source', async (t) => {
  const {controller, baseline, records} = setup(t, async () => ({
    status: 'retryable_error',
  }))
  await controller.hydrate()
  usePersistStore.getState().setMutateNoteData({content: 'Source to discard'})
  controller.record.conflict = baseline
  await controller.editCopy()
  const sourceId = controller.record.id
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(JSON.stringify(baseline), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      }),
  )
  await controller.resolve('saved', baseline.revision)
  assert.equal(records.has(sourceId), false)
  assert.equal(controller.record.retainedSource, undefined)
  assert.equal(controller.record.draft.content, baseline.content)
  assert.equal(
    [...records.values()].filter((row) => row.editedCopyOf).length,
    1,
  )
})

test('a resolved working copy resumes normal field reconciliation for subsequent edits', async (t) => {
  const {controller, baseline, records, io} = setup(t, async (request) => ({
    status: 'success',
    note: {...baseline, ...request.content, revision: crypto.randomUUID()},
  }))
  await controller.hydrate()
  controller.record.editedCopyOf = crypto.randomUUID()
  controller.record.versionId = crypto.randomUUID()
  controller.record.conflict = baseline
  usePersistStore.getState().setMutateNoteData({content: 'Composed result'})
  await controller.resolve('mine', baseline.revision)
  // Continue writing after the resolution, then reload after another device
  // changes an independent field. That title must not be written back stale.
  usePersistStore.getState().setMutateNoteData({content: 'Later browser edit'})
  await controller.persist()
  const recovery = structuredClone(records.get(controller.record.id)!)
  const remote = {
    ...controller.record.baseline,
    title: 'New title on another device',
    revision: crypto.randomUUID(),
  } as Note
  controller.stop()
  usePersistStore.getState().resetNoteStore()
  usePersistStore.getState().beginNoteSession('resolved-reload', remote)
  const resumed = new NoteSyncSession(
    baseline.authorId,
    usePersistStore.getState().noteSession!,
    remote,
    io,
  )
  t.after(() => resumed.stop())
  await resumed.hydrate(recovery)
  assert.equal(resumed.record.draft.content, 'Later browser edit')
  assert.equal(resumed.record.draft.title, remote.title)
  assert.equal(resumed.record.editedCopyOf, undefined)
  assert.equal(resumed.record.conflict, undefined)
})

test('a retained source rejects a stale resolution without changing its authored fields', async (t) => {
  const {controller, baseline, records, io} = setup(t, async () => ({
    status: 'retryable_error',
  }))
  await controller.hydrate()
  usePersistStore
    .getState()
    .setMutateNoteData({content: 'Retained source body'})
  controller.record.conflict = baseline
  await controller.editCopy()
  const source = structuredClone(controller.record.draft)
  const newer = {
    ...baseline,
    title: 'New independent remote title',
    revision: crypto.randomUUID(),
  }
  let sends = 0
  io.send = async () => {
    sends++
    return {status: 'conflict', note: newer}
  }
  await controller.resolve('mine', baseline.revision)
  assert.equal(sends, 1)
  assert.deepEqual(controller.record.draft, source)
  assert.equal(controller.record.conflict?.revision, newer.revision)
  assert.deepEqual(records.get(controller.record.id)?.draft, source)
})

for (const choice of ['saved', 'acknowledged read'] as const) {
  test(`${choice} ends working-copy composition without retiring its source`, async (t) => {
    const {controller, baseline, records, io} = setup(t, async () => ({
      status: 'retryable_error',
    }))
    await controller.hydrate()
    const source = {
      ...structuredClone(controller.record),
      id: crypto.randomUUID(),
      versionId: crypto.randomUUID(),
      retainedSource: true,
    }
    records.set(source.id, source)
    controller.record.editedCopyOf = source.versionId
    controller.record.conflict = baseline
    usePersistStore.getState().setMutateNoteData({content: 'Composed copy'})
    if (choice === 'saved') {
      t.mock.method(globalThis, 'fetch', async () => Response.json(baseline))
      await controller.resolve('saved', baseline.revision)
      assert.equal(controller.record.draft.content, baseline.content)
    } else {
      await controller.resolve('mine', baseline.revision)
      const flight = controller.record.flight!
      io.read = async () => ({
        status: 'success',
        note: {
          ...baseline,
          ...flight.content,
          lastMutationId: flight.mutationId,
          revision: crypto.randomUUID(),
        },
      })
      await controller.refreshRemote()
      assert.equal(controller.record.draft.content, 'Composed copy')
    }
    assert.equal(controller.record.editedCopyOf, undefined)
    assert.equal(controller.record.conflict, undefined)
    assert.equal(controller.record.flight, undefined)
    assert.deepEqual(records.get(source.id), source)
    assert.equal(records.has(controller.record.id), false)
  })
}
