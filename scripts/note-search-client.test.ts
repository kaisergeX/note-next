import assert from 'node:assert/strict'
import {test} from 'node:test'
import {randomUUID} from 'node:crypto'
import {
  noteSearchKey,
  NoteSearchRequestError,
  readNoteSearchPage,
} from '../lib/notes/search-client'
import {
  reconcileNoteSearch,
  pendingNoteAcknowledgements,
  type SearchDisplayOverride,
} from '../lib/notes/search-reconciliation'
import type {NoteSearchMatch} from '../lib/notes/search'

const alice = randomUUID()
const bob = randomUUID()
function match(overrides: Partial<NoteSearchMatch> = {}): NoteSearchMatch {
  return {
    id: randomUUID(),
    authorId: alice,
    title: '<p>Saved title</p>',
    content: null,
    theme: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    pendingDeleteAt: null,
    revision: randomUUID(),
    isEncrypted: false,
    snippet: 'saved query match',
    ...overrides,
  }
}
function displayed(
  id: string,
  content: string,
  overrides: Partial<SearchDisplayOverride> = {},
): SearchDisplayOverride {
  return {
    id,
    ownerId: alice,
    title: '<p>Draft title</p>',
    content,
    isEncrypted: false,
    ...overrides,
  }
}

test('authoritative refetch expires an acknowledgement even when its older off-page note is absent', () => {
  const note = {...match(), isArchived: false, lastMutationId: null}
  const entries = {[note.id]: {note, recordedAt: 100}}
  assert.equal(Object.keys(pendingNoteAcknowledgements(entries, 0)).length, 1)
  assert.equal(Object.keys(pendingNoteAcknowledgements(entries, 99)).length, 1)
  const reconciled = pendingNoteAcknowledgements(entries, 101)
  assert.deepEqual(reconciled, {})
  assert.equal(
    reconcileNoteSearch(
      alice,
      'saved query',
      [],
      Object.values(reconciled).map(({note: current}) =>
        displayed(current.id, current.content ?? ''),
      ),
    ).size,
    0,
  )
})

test('search requests keep terms out of URLs and preserve cursors/cancellation signal', async (t) => {
  const controller = new AbortController()
  const cursor = {id: randomUUID(), createdAt: '2026-01-01T00:00:00.123456Z'}
  const saved = match()
  t.mock.method(
    globalThis,
    'fetch',
    async (url: string, options: RequestInit) => {
      assert.equal(url, '/api/note/search')
      assert.equal(options.method, 'POST')
      assert.equal(options.cache, 'no-store')
      assert.equal(options.signal, controller.signal)
      assert.deepEqual(JSON.parse(options.body as string), {
        query: 'private query',
        cursor,
      })
      return Response.json({ownerId: alice, notes: [saved], nextCursor: cursor})
    },
  )
  const page = await readNoteSearchPage(
    alice,
    'private query',
    cursor,
    controller.signal,
  )
  assert.equal(page.notes[0].id, saved.id)
  assert.deepEqual(page.nextCursor, cursor)
  assert.deepEqual(noteSearchKey(alice, ' CAFE\u0301 '), [
    'note-search',
    alice,
    'café',
  ])
  assert.notDeepEqual(noteSearchKey(alice, 'same'), noteSearchKey(bob, 'same'))
})

test('response boundary rejects changed accounts and strips encrypted bodies/snippets', async (t) => {
  const saved = match({
    isEncrypted: true,
    content: 'opaque-body',
    snippet: 'previous secret plaintext',
  })
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      ownerId: alice,
      notes: [saved, match({authorId: bob})],
      nextCursor: null,
    }),
  )
  const page = await readNoteSearchPage(
    alice,
    'title',
    null,
    new AbortController().signal,
  )
  assert.equal(page.notes.length, 1)
  assert.equal(page.notes[0].content, null)
  assert.equal(page.notes[0].snippet, '')
  await assert.rejects(
    readNoteSearchPage(bob, 'title', null, new AbortController().signal),
    (error: unknown) =>
      error instanceof NoteSearchRequestError &&
      error.code === 'account_changed',
  )
})

test('unready search remains a retryable failure, not an empty result page', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({code: 'search_not_ready'}, {status: 503}),
  )
  await assert.rejects(
    readNoteSearchPage(alice, 'query', null, new AbortController().signal),
    (error: unknown) =>
      error instanceof NoteSearchRequestError && error.code === 'not_ready',
  )
})

test('changing a query can abort its in-flight request', async (t) => {
  const controller = new AbortController()
  t.mock.method(
    globalThis,
    'fetch',
    (_url: string, options: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        options.signal!.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          {once: true},
        )
      }),
  )
  const request = readNoteSearchPage(alice, 'query', null, controller.signal)
  controller.abort()
  await assert.rejects(request, {name: 'AbortError'})
})

test('displayed drafts suppress stale hits across later server pages and add their own matches', () => {
  const saved = match()
  const draft = displayed(saved.id, '<p>new phrase</p>')
  assert.equal(
    reconcileNoteSearch(alice, 'saved query', [saved], [draft]).size,
    0,
  )
  // Reconciliation is repeated against every newly loaded page, so no separate
  // stale-hit cache can accidentally re-add this identity.
  assert.equal(
    reconcileNoteSearch(alice, 'saved query', [saved, {...saved}], [draft])
      .size,
    0,
  )
  const matches = reconcileNoteSearch(alice, 'new phrase', [], [draft])
  assert.match(matches.get(saved.id)!, /new phrase/)
  const newId = randomUUID()
  assert.ok(
    reconcileNoteSearch(
      alice,
      'local-only',
      [],
      [displayed(newId, '<p>local-only match</p>')],
    ).has(newId),
  )
})

test('only exact displayed versions participate; ambiguous hidden candidates stay excluded', () => {
  const saved = match()
  // With ambiguous local copies, the caller supplies no draft override: the
  // saved preview/chooser remains authoritative until a user chooses a version.
  assert.equal(
    reconcileNoteSearch(alice, 'saved query', [saved], []).get(saved.id),
    saved.snippet,
  )
  assert.equal(
    reconcileNoteSearch(alice, 'hidden-draft-only-query', [], []).size,
    0,
  )
  const acknowledged = displayed(saved.id, '<p>acknowledged replacement</p>')
  assert.equal(
    reconcileNoteSearch(alice, 'saved query', [saved], [acknowledged]).size,
    0,
  )
  assert.ok(
    reconcileNoteSearch(alice, 'replacement', [], [acknowledged]).has(saved.id),
  )
})

test('reconciliation isolates accounts, removes trashed matches, and enforces encrypted title-only matches', () => {
  const saved = match()
  assert.equal(
    reconcileNoteSearch(alice, 'saved query', [match({authorId: bob})], [])
      .size,
    0,
  )
  assert.equal(
    reconcileNoteSearch(
      alice,
      'saved query',
      [saved],
      [displayed(saved.id, '<p>foreign</p>', {ownerId: bob})],
    ).size,
    1,
  )
  assert.equal(
    reconcileNoteSearch(
      alice,
      'saved query',
      [saved],
      [displayed(saved.id, '<p>saved query</p>', {deleted: true})],
    ).size,
    0,
  )
  assert.equal(
    reconcileNoteSearch(
      alice,
      'saved query',
      [match({pendingDeleteAt: new Date()})],
      [],
    ).size,
    0,
  )
  const encrypted = displayed(saved.id, '<p>saved query secret</p>', {
    title: '<p>encrypted-title</p>',
    isEncrypted: true,
  })
  assert.equal(
    reconcileNoteSearch(alice, 'saved query', [saved], [encrypted]).size,
    0,
  )
  assert.equal(
    reconcileNoteSearch(alice, 'encrypted-title', [], [encrypted]).get(
      saved.id,
    ),
    '',
  )
})
