import assert from 'node:assert/strict'
import {after, before, test} from 'node:test'
import {randomUUID} from 'node:crypto'
import {eq, sql} from 'drizzle-orm'
import {openSearchTestDatabase} from './note-search-test-db'
import {createNoteRepository} from '../db/repositories/notes'
import {
  backfillNoteSearch,
  createNoteSearchRepository,
  writeSearchDocument,
} from '../db/repositories/note-search'
import {notesTable} from '../db/schema/notes'
import {noteSearchDocumentsTable as documents} from '../db/schema/note-search'
import {usersTable} from '../db/schema/users'
import {
  foldSearchText,
  hasSearchTrigram,
  matchNoteSearch,
  NoteSearchNotReadyError,
  searchableNoteText,
  NOTE_SEARCH_PAGE_SIZE,
  NOTE_SEARCH_SNIPPET_LENGTH,
} from '../lib/notes/search'
import type {NoteCursor} from '../lib/notes/pages'
import {createAccountRepository} from '../db/repositories/account'
import {snapshot} from '../lib/notes/sync'

const {client, db} = await openSearchTestDatabase()
const repo = createNoteRepository(db)
const search = createNoteSearchRepository(db)
let alice: string
let bob: string

before(async () => {
  const owners = await db
    .insert(usersTable)
    .values([
      {
        name: 'Search Alice',
        email: `search-alice-${randomUUID()}@test.invalid`,
      },
      {name: 'Search Bob', email: `search-bob-${randomUUID()}@test.invalid`},
    ])
    .returning()
  ;[alice, bob] = owners.map((owner) => owner.id)
})
after(async () => {
  await client.end()
})

async function create(title: string, content: string | null, ownerId = alice) {
  const result = await repo.createNote(ownerId, {title, content})
  assert.equal(result.status, 'success')
  if (result.status !== 'success') throw new Error(result.status)
  return result.note
}
async function ids(query: string, ownerId = alice) {
  return (await search.search(ownerId, query)).notes.map((note) => note.id)
}

test('visible projection decodes entities once, preserves inline adjacency and separates blocks', () => {
  assert.equal(
    searchableNoteText(
      '<p>hel<strong>lo</strong><em>世界</em></p><p>A<br>B</p>',
    ),
    'hello世界 A B',
  )
  assert.equal(
    searchableNoteText(
      '<p>&copy; &eacute; &#x1f680; &amp;lt; &lt;script&gt;</p>',
    ),
    '© é 🚀 &lt; <script>',
  )
  assert.equal(
    searchableNoteText(
      '<p title="hidden">shown</p><script>secret</script><style>secret</style><svg><text>secret</text></svg><!--secret-->',
    ),
    'shown',
  )
  assert.equal(searchableNoteText('<p>cafe\u0301\t\n世界</p>'), 'café 世界')
})

test('local matching suppresses stale server hits and uses representative draft snippets', () => {
  const saved = {title: '<p>Draft fixture</p>', content: '<p>old-query</p>'}
  assert.ok(matchNoteSearch(saved, 'old-query'))
  const draft = {...saved, content: '<p>replacement-query</p>'}
  assert.equal(matchNoteSearch(draft, 'old-query'), null)
  assert.match(
    matchNoteSearch(draft, 'replacement-query')!.snippet,
    /replacement-query/,
  )
  assert.equal(
    matchNoteSearch({...saved, isEncrypted: true}, 'old-query'),
    null,
  )
  assert.deepEqual(
    matchNoteSearch({...saved, isEncrypted: true}, 'Draft fixture'),
    {snippet: ''},
  )
  const body = `<p>${'İ'.repeat(300)} ${'🌏'.repeat(300)} late-draft-needle café</p>`
  const match = matchNoteSearch(
    {title: null, content: body},
    'LATE-DRAFT-NEEDLE',
  )!
  assert.match(match.snippet, /late-draft-needle/)
  assert.ok(Array.from(match.snippet).length <= NOTE_SEARCH_SNIPPET_LENGTH + 2)
  assert.ok(matchNoteSearch({title: null, content: body}, 'cafe\u0301'))
  for (const query of ['世', '東京', '🚀', '%', 'a b c', '++', 'a_b', 'हिन्दी'])
    assert.equal(hasSearchTrigram(query), false, query)
  for (const query of ['hello', 'العربية', '中文筆記', 'ภาษาไทย', 'कखग'])
    assert.equal(hasSearchTrigram(query), true, query)
})

test('literal matching handles scripts, canonical equivalence, symbols, single characters and inline words', async () => {
  const note = await create(
    '<p>Universal fixture</p>',
    '<p>hel<strong>lo</strong>世界 ภาษาไทย العربية हिन्दी 한글 café Tiếng Việt 100% a_b C:\\tmp 🚀 &copy; &amp;lt;</p>',
  )
  for (const query of [
    'hello',
    'lo世',
    '世界',
    '世',
    'ภาษา',
    'العربية',
    'हिन्दी',
    '한글'.normalize('NFD'),
    'cafe\u0301',
    'TIẾNG',
    '100%',
    'a_b',
    'C:\\tmp',
    '🚀',
    '©',
    '&lt;',
  ])
    assert.ok((await ids(query)).includes(note.id), query)
  for (const query of ['hel lo', '100x', 'axb', 'script'])
    assert.ok(!(await ids(query)).includes(note.id), query)
  assert.deepEqual(await ids('   '), [])
  assert.deepEqual(await ids('x'.repeat(257)), [])
})

test('owner-scoped whole-collection search paginates tied microseconds independently of list pages', async () => {
  const fixtureIds: string[] = []
  for (let index = 0; index < 61; index++) {
    const note = await create(
      `<p>pagination-${index}</p>`,
      '<p>needle pagination fixture</p>',
    )
    fixtureIds.push(note.id)
    await db
      .update(notesTable)
      .set({createdAt: sql`'2030-01-01T00:00:00.123456Z'::timestamptz`})
      .where(eq(notesTable.id, note.id))
  }
  await create(
    '<p>pagination other owner</p>',
    '<p>needle pagination fixture</p>',
    bob,
  )
  const seen: string[] = []
  let cursor: NoteCursor | null = null
  do {
    const page = await search.search(alice, 'needle pagination', cursor)
    assert.ok(page.notes.length <= NOTE_SEARCH_PAGE_SIZE)
    for (const note of page.notes) {
      assert.equal(note.authorId, alice)
      assert.equal(note.content, null)
      assert.ok(note.snippet.length <= NOTE_SEARCH_SNIPPET_LENGTH + 2)
    }
    seen.push(...page.notes.map((note) => note.id))
    cursor = page.nextCursor
    if (cursor) assert.match(cursor.createdAt, /\.123456Z$/)
  } while (cursor)
  assert.deepEqual(seen, fixtureIds.sort().reverse())
  const first = await search.search(alice, 'needle pagination')
  assert.deepEqual(
    await search.search(alice, 'needle pagination', first.nextCursor),
    await search.search(alice, 'needle pagination', first.nextCursor),
  )
  assert.deepEqual(await search.search('invalid', 'needle'), {
    notes: [],
    nextCursor: null,
  })
})

test('representative snippets find late body matches and account for Unicode lowercase expansion', async () => {
  const note = await create(
    '<p>Long note</p>',
    `<p>${'İ'.repeat(5000)} ${'intro '.repeat(4000)} representative-late-hit ${'tail '.repeat(1000)}</p>`,
  )
  const [match] = (await search.search(alice, 'representative-late-hit')).notes
  assert.equal(match.id, note.id)
  assert.match(match.snippet, /representative-late-hit/)
  assert.ok(match.snippet.length <= NOTE_SEARCH_SNIPPET_LENGTH + 2)
  assert.match(match.snippet, /^…/)
})

test('encryption transition clears derived body and title-only search never returns ciphertext or plaintext body', async () => {
  const note = await create(
    '<p>private-title-fixture</p>',
    '<p>previous-secret-body</p>',
  )
  assert.ok((await ids('previous-secret-body')).includes(note.id))
  await db
    .update(notesTable)
    .set({isEncrypted: true, content: 'CIPHERTEXT-secret-body'})
    .where(eq(notesTable.id, note.id))
  let [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.noteId, note.id))
  assert.equal(doc.bodyText, null)
  assert.equal(doc.bodyFold, null)
  for (const query of ['previous-secret-body', 'CIPHERTEXT-secret-body'])
    assert.ok(!(await ids(query)).includes(note.id))
  const [match] = (await search.search(alice, 'private-title-fixture')).notes
  assert.equal(match.content, null)
  assert.equal(match.snippet, '')
  assert.equal(match.isEncrypted, true)
  assert.ok(!JSON.stringify(match).includes('secret-body'))
  // Database guard also protects accidental writes outside the repository.
  await db
    .update(documents)
    .set({bodyText: 'accidental plaintext', bodyFold: 'accidental plaintext'})
    .where(eq(documents.noteId, note.id))
  ;[doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.noteId, note.id))
  assert.equal(doc.bodyText, null)
  assert.equal(doc.bodyFold, null)
  await repo.updateNote(alice, note.id, {title: '<p>renamed-private-title</p>'})
  assert.ok((await ids('renamed-private-title')).includes(note.id))
  assert.ok(!(await ids('private-title-fixture')).includes(note.id))
})

test('updates, trash/restore and account deletion cannot retain stale searchable bodies', async () => {
  const note = await create(
    '<p>lifecycle-search-fixture</p>',
    '<p>obsolete-body-fixture</p>',
  )
  await repo.updateNote(alice, note.id, {
    content: '<p>replacement-body-fixture</p>',
  })
  assert.ok(!(await ids('obsolete-body-fixture')).includes(note.id))
  assert.ok((await ids('replacement-body-fixture')).includes(note.id))
  const trashed = await repo.moveNoteToTrash(alice, note.id)
  assert.equal(trashed.status, 'success')
  assert.ok(!(await ids('lifecycle-search-fixture')).includes(note.id))
  if (trashed.status !== 'success') throw new Error(trashed.status)
  await repo.restoreNote(alice, note.id, trashed.note.deadlineToken)
  assert.ok((await ids('replacement-body-fixture')).includes(note.id))
  const other = await create(
    '<p>other-account-fixture</p>',
    '<p>other-account-body</p>',
    bob,
  )
  assert.deepEqual(await ids('other-account-body'), [])
  await createAccountRepository(db).deleteAccount(bob)
  assert.deepEqual(
    await db.select().from(documents).where(eq(documents.noteId, other.id)),
    [],
  )
})

test('legacy/direct edits explicitly report unready until resumable backfill; backfill preserves revisions', async () => {
  const [note] = await db
    .insert(notesTable)
    .values({
      authorId: alice,
      title: '<p>legacy-needle</p>',
      content: '<p>legacy-body-needle</p>',
    })
    .returning()
  await assert.rejects(
    search.search(alice, 'legacy-body-needle'),
    NoteSearchNotReadyError,
  )
  while (await backfillNoteSearch(db, 3)) {
    /* bounded, resumable */
  }
  assert.ok((await ids('legacy-body-needle')).includes(note.id))
  const [current] = await db
    .select()
    .from(notesTable)
    .where(eq(notesTable.id, note.id))
  assert.equal(current.revision, note.revision)
  assert.equal(current.updatedAt.toISOString(), note.updatedAt.toISOString())
  assert.equal(await backfillNoteSearch(db, 3), 0)
  await db
    .update(notesTable)
    .set({content: '<p>direct-edit-needle</p>'})
    .where(eq(notesTable.id, note.id))
  await assert.rejects(
    search.search(alice, 'legacy-body-needle'),
    NoteSearchNotReadyError,
  )
  await backfillNoteSearch(db)
  assert.ok(!(await ids('legacy-body-needle')).includes(note.id))
  assert.ok((await ids('direct-edit-needle')).includes(note.id))
})

test('projection failure rolls back the note mutation', async () => {
  const note = await create(
    '<p>atomic-search-fixture</p>',
    '<p>atomic-old-body</p>',
  )
  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.execute(
        sql`CREATE FUNCTION pg_temp.reject_search_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'projection unavailable'; END; $$`,
      )
      await tx.execute(
        sql`CREATE TRIGGER reject_search_write BEFORE INSERT ON note_search_documents FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_search_write()`,
      )
      await createNoteRepository(tx).updateNote(alice, note.id, {
        content: '<p>atomic-new-body</p>',
      })
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.match(String(error.cause), /projection unavailable/)
      return true
    },
  )
  assert.equal((await repo.getNote(alice, note.id))!.content, note.content)
  assert.ok((await ids('atomic-old-body')).includes(note.id))
  assert.ok(!(await ids('atomic-new-body')).includes(note.id))
  assert.equal(foldSearchText('CAFE\u0301'), 'café')
})

test('a stale retry cannot replace a newer search projection', async () => {
  const original = await create(
    '<p>stale-projection-fixture</p>',
    '<p>old-retry-body</p>',
  )
  await repo.updateNote(alice, original.id, {
    content: '<p>newer-retry-body</p>',
  })
  await db.transaction((tx) => writeSearchDocument(tx, original))
  assert.ok(!(await ids('old-retry-body')).includes(original.id))
  assert.ok((await ids('newer-retry-body')).includes(original.id))
})

test('theme edits and idempotent saves keep the existing projection; missing projections still heal', async () => {
  const note = await create(
    '<p>unchanged-projection-fixture</p>',
    `<p>${'large unchanged body '.repeat(5000)}</p>`,
  )
  const physicalProjection = async () => {
    const [row] = await db
      .select({version: sql<string>`xmin::text`})
      .from(documents)
      .where(eq(documents.noteId, note.id))
    return row?.version
  }
  const originalProjection = await physicalProjection()
  await repo.updateNote(alice, note.id, {theme: 'red'})
  assert.equal(await physicalProjection(), originalProjection)
  const current = (await repo.getNote(alice, note.id))!
  const request = {
    ownerId: alice,
    noteId: note.id,
    creationId: randomUUID(),
    mutationId: randomUUID(),
    expectedRevision: current.revision,
    content: snapshot(current),
    kind: 'save' as const,
  }
  assert.equal((await repo.syncNote(alice, request)).status, 'success')
  assert.equal(await physicalProjection(), originalProjection)
  assert.equal((await repo.syncNote(alice, request)).status, 'success')
  assert.equal(await physicalProjection(), originalProjection)
  await db.delete(documents).where(eq(documents.noteId, note.id))
  await assert.rejects(
    search.search(alice, 'unchanged-projection-fixture'),
    NoteSearchNotReadyError,
  )
  await repo.updateNote(alice, note.id, {theme: 'blue'})
  assert.ok((await ids('unchanged-projection-fixture')).includes(note.id))
  assert.notEqual(await physicalProjection(), originalProjection)
})
