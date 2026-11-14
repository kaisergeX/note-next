import assert from 'node:assert/strict'
import {test} from 'node:test'
import {randomUUID} from 'node:crypto'
import {
  generateRoot,
  importRoot,
  sealNote,
} from '../lib/notes/encryption/crypto'
import {
  RecoverySealQueue,
  hasPendingEncryptedEdits,
  validateRecoveryPayload,
  type RecoveryPayload,
} from '../lib/notes/encryption/recovery'
import {
  canCommitCheckpoint,
  recoveryRouteFromHeader,
  type RecoveryHeader,
} from '../lib/notes/encryption/storage'
import {
  prepareEncryptedWrite,
  sendEncryptedFlight,
  fetchEncryptedNote,
} from '../lib/notes/encryption/sync'

const ownerId = randomUUID(),
  vaultId = randomUUID(),
  noteId = randomUUID()
const fixture = (): RecoveryPayload => ({
  version: 1,
  route: {
    ownerId,
    vaultId,
    stableNoteId: noteId,
    recordId: randomUUID(),
    generation: 1,
    capturedEpoch: 0,
    mode: 'encrypted',
    noteId: null,
    creationId: noteId,
    sourceNoteId: null,
    sourceEpoch: null,
    flightDestination: null,
    mutationId: null,
    expectedRevision: null,
  },
  baseline: null,
  draft: {title: '<p>secret</p>', content: '<p>private</p>', theme: null},
  conflict: null,
  flight: null,
  resolution: null,
})
test('pending edits include theme changes; legacy records carry no clean proof', () => {
  const record = fixture()
  record.baseline = structuredClone(record.draft)
  assert.equal(hasPendingEncryptedEdits(record), false)
  assert.equal(
    validateRecoveryPayload(record, record.route).baselineVerified,
    undefined,
  )
  record.draft.content = '<p>unsent</p>'
  assert.equal(hasPendingEncryptedEdits(record), true)
  record.draft = structuredClone(record.baseline)
  record.draft.theme = 'rose'
  assert.equal(hasPendingEncryptedEdits(record), true)
})
test('a failed authoritative read cannot be mistaken for a deleted note', async ({
  mock,
}) => {
  const fetcher = mock.method(globalThis, 'fetch', async () =>
    Response.json({status: 'retryable_error'}),
  )
  await assert.rejects(fetchEncryptedNote(noteId))
  fetcher.mock.mockImplementation(async () =>
    Response.json({status: 'unavailable'}),
  )
  assert.equal(await fetchEncryptedNote(noteId), null)
})
test('full storage headers project every authenticated route field before strict parsing', () => {
  const record = fixture()
  const header: RecoveryHeader = {
    ...record.route,
    id: record.route.recordId,
    updatedAt: 1,
    status: 'local',
    versionId: randomUUID(),
    encodedBytes: 100,
  }
  assert.deepEqual(recoveryRouteFromHeader(header), record.route)
  assert.deepEqual(
    validateRecoveryPayload(record, recoveryRouteFromHeader(header)),
    record,
  )
  assert.throws(() =>
    validateRecoveryPayload(
      record,
      recoveryRouteFromHeader({
        ...header,
        sourceNoteId: randomUUID(),
        sourceEpoch: 0,
      }),
    ),
  )
})
test('authenticated recovery rejects outer route substitution even at equal generation', () => {
  const record = fixture()
  assert.equal(
    validateRecoveryPayload(record, record.route).draft.title,
    record.draft.title,
  )
  for (const key of ['ownerId', 'vaultId', 'recordId', 'creationId'] as const)
    assert.throws(() =>
      validateRecoveryPayload(record, {...record.route, [key]: randomUUID()}),
    )
  assert.throws(() =>
    validateRecoveryPayload(record, {...record.route, capturedEpoch: 1}),
  )
})
test('recovery copies require paired source identity and epoch', () => {
  const record = fixture()
  record.route.sourceNoteId = randomUUID()
  assert.throws(() => validateRecoveryPayload(record, record.route))
})
test('recovery rejects recursive records and mixed plaintext flight request', () => {
  const record = fixture()
  assert.throws(() =>
    validateRecoveryPayload({...record, history: [record]}, record.route),
  )
  const mutationId = randomUUID()
  Object.assign(record.route, {flightDestination: noteId, mutationId})
  record.flight = {
    destination: noteId,
    mutationId,
    expectedRevision: null,
    request: JSON.stringify({title: 'plaintext'}),
  }
  assert.throws(() => validateRecoveryPayload(record, record.route))
})
test('checkpoint comparison rejects stale epochs, equal generations and changed immutable flight', () => {
  const header: RecoveryHeader = {
    ...fixture().route,
    id: randomUUID(),
    updatedAt: 0,
    status: 'local',
    versionId: randomUUID(),
    encodedBytes: 1,
  }
  assert.equal(canCommitCheckpoint(header, {...header, generation: 2}), true)
  assert.equal(canCommitCheckpoint(header, {...header}), false)
  // Both tabs began at generation 1; tab B has more keystrokes than A.
  // Its larger counter must not overwrite A's checkpoint at generation 2.
  assert.equal(
    canCommitCheckpoint(
      {...header, generation: 2},
      {...header, generation: 12},
      null,
      1,
    ),
    false,
  )
  assert.equal(
    canCommitCheckpoint(
      {...header, generation: 2},
      {...header, generation: 12},
      null,
      2,
    ),
    true,
  )
  assert.equal(
    canCommitCheckpoint(header, {...header, generation: 2, capturedEpoch: 1}),
    false,
  )
  const flight = randomUUID()
  assert.equal(
    canCommitCheckpoint(
      {...header, mutationId: flight},
      {...header, generation: 2},
    ),
    false,
  )
  assert.equal(
    canCommitCheckpoint(
      {...header, mutationId: flight},
      {...header, generation: 2},
      flight,
    ),
    true,
  )
})
test('saturated seal queue retains one latest pending snapshot and commits progress', async () => {
  const queue = new RecoverySealQueue(),
    committed: number[] = []
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const first = queue.enqueue(noteId, async () => {
    await gate
    committed.push(1)
  })
  for (let generation = 2; generation <= 100; generation++) {
    void queue.enqueue(noteId, async () => {
      committed.push(generation)
    })
    assert.equal(queue.queuedNotes, 1)
  }
  release()
  await first
  assert.deepEqual(committed, [1, 100])
})
test('seal queue gives other notes a turn before the active note latest generation', async () => {
  const queue = new RecoverySealQueue(),
    committed: string[] = []
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const done = queue.enqueue('one', async () => {
    await gate
    committed.push('one:1')
  })
  void queue.enqueue('two', async () => {
    committed.push('two:1')
  })
  void queue.enqueue('one', async () => {
    committed.push('one:2')
  })
  release()
  await done
  assert.deepEqual(committed, ['one:1', 'two:1', 'one:2'])
})
test('uncertain uploads retry the exact immutable serialized envelope', async () => {
  const root = await importRoot(generateRoot())
  const payload = await sealNote(
    root,
    ownerId,
    {vaultId, noteId, contentId: randomUUID()},
    fixture().draft,
  )
  const request = prepareEncryptedWrite(payload, null, null)
  const bodies: unknown[] = []
  const fetcher = (async (_url, init) => {
    bodies.push(init?.body)
    throw new Error('Lost acknowledgement')
  }) as typeof fetch
  assert.equal(
    (await sendEncryptedFlight(noteId, request, fetcher)).status,
    'retryable_error',
  )
  assert.equal(
    (await sendEncryptedFlight(noteId, request, fetcher)).status,
    'retryable_error',
  )
  assert.deepEqual(bodies, [request, request])
  await assert.rejects(sendEncryptedFlight(randomUUID(), request, fetcher))
  assert.equal(bodies.length, 2)
})
