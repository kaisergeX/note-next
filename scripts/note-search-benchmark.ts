import {performance} from 'node:perf_hooks'
import {randomUUID} from 'node:crypto'
import {sql} from 'drizzle-orm'
import {openSearchTestDatabase} from './note-search-test-db'
import {notesTable} from '../db/schema/notes'
import {usersTable} from '../db/schema/users'
import {noteSearchDocumentsTable as documents} from '../db/schema/note-search'
import {createNoteSearchRepository} from '../db/repositories/note-search'
import {createNoteRepository} from '../db/repositories/notes'
import {snapshot} from '../lib/notes/sync'
import {
  foldSearchText,
  hasSearchTrigram,
  searchableNoteText,
  searchPattern,
} from '../lib/notes/search'

// Deterministic mixed-script, varied-size fixtures; benchmark only the disposable
// database created by run-note-search-tests.mjs. No app note content is read.
const {client, db} = await openSearchTestDatabase()
const count = 12000
let state = 7409
function random() {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0
  return state / 2 ** 32
}
const words = Array.from(
  {length: 4096},
  (_, i) => `word${i.toString(36)}-${Math.floor(random() * 1e9).toString(36)}`,
)
const scripts = [
  '東京の旅と研究',
  'ภาษาไทยไม่มีช่องว่าง',
  'العربية ملاحظات',
  'हिन्दी टिप्पणियाँ',
  'Tiếng Việt café',
  '한글 메모',
  '🚀 + 100% a_b C:\\tmp',
]
const cases = [
  'selectivebeacon',
  '東京',
  'العربية',
  'rare-title-beacon',
  '世',
  '🚀',
  '🧬',
  '龘龘',
  '%',
  'absent-query-zzzz',
  'word',
]
try {
  const owners = await db
    .insert(usersTable)
    .values(
      Array.from({length: 4}, (_, i) => ({
        name: `Benchmark ${i}`,
        email: `benchmark-${i}-${randomUUID()}@test.invalid`,
      })),
    )
    .returning()
  const ownerId = owners[0].id
  const started = performance.now()
  let sourceBytes = 0
  let longNotes = 0
  for (let offset = 0; offset < count; offset += 100) {
    const notes = Array.from(
      {length: Math.min(100, count - offset)},
      (_, i) => {
        const index = offset + i
        const choice = random()
        const size =
          choice < 0.4
            ? 1024
            : choice < 0.75
              ? 4096
              : choice < 0.95
                ? 16384
                : choice < 0.99
                  ? 65536
                  : 200000
        if (size >= 65536) longNotes++
        const chunks: string[] = []
        for (let length = 0; length < size;) {
          const chunk = `<p>${Array.from({length: 16}, () => words[Math.floor(random() * words.length)]).join(' ')} ${scripts[index % scripts.length]} 世</p>`
          chunks.push(chunk)
          length += chunk.length
        }
        if (index % 71 === 0)
          chunks.push('<p>selective<strong>beacon</strong> late match</p>')
        const isEncrypted = index % 97 === 0
        const content = isEncrypted
          ? 'opaque encrypted fixture; no encryption implementation implied'
          : chunks.join('')
        sourceBytes += Buffer.byteLength(content)
        return {
          id: randomUUID(),
          authorId: owners[index % owners.length].id,
          title: `<p>Notebook ${index}${index % 251 === 0 ? ' rare-title-beacon' : ''}</p>`,
          content,
          isEncrypted,
          pendingDeleteAt: index % 10 === 0 ? new Date('2030-01-01') : null,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 0, count - index)),
        }
      },
    )
    await db.insert(notesTable).values(notes)
    await db.insert(documents).values(
      notes.map((note) => {
        const titleText = searchableNoteText(note.title)
        const bodyText = note.isEncrypted
          ? null
          : searchableNoteText(note.content)
        return {
          noteId: note.id,
          titleText,
          bodyText,
          titleFold: foldSearchText(titleText),
          bodyFold: bodyText === null ? null : foldSearchText(bodyText),
        }
      }),
    )
    if (offset % 2000 === 0)
      console.log(`Benchmark fixtures: ${offset + notes.length}/${count}`)
  }
  await client`SELECT gin_clean_pending_list('note_search_title_trgm_idx'), gin_clean_pending_list('note_search_body_trgm_idx')`
  await client`ANALYZE notes`
  await client`ANALYZE note_search_documents`
  console.log(
    JSON.stringify({
      fixtures: count,
      ownerNotes: count / 4,
      longNotes,
      sourceMiB: +(sourceBytes / 1024 ** 2).toFixed(1),
      seedSeconds: +((performance.now() - started) / 1000).toFixed(1),
      server: (await client`SHOW server_version`)[0].server_version,
    }),
  )
  const plans: unknown[] = []
  const results: Record<string, unknown>[] = []
  const baselineRollback = new Error('Baseline benchmark rollback')
  for (const indexed of [false, true]) {
    await db
      .transaction(async (tx) => {
        if (!indexed) {
          await tx.execute(sql`DROP INDEX note_search_title_trgm_idx`)
          await tx.execute(sql`DROP INDEX note_search_body_trgm_idx`)
        }
        for (const query of cases) {
          const pattern = searchPattern(query)
          const documentJoin = hasSearchTrigram(query)
            ? sql`JOIN note_search_documents d ON d.note_id = n.id`
            : sql`JOIN LATERAL (SELECT * FROM note_search_documents WHERE note_id = n.id LIMIT 1) d ON true`
          const statement = sql`SELECT n.id FROM notes n ${documentJoin}
          WHERE n.author_id = ${ownerId} AND n.pending_deleted_at IS NULL
          AND (d.title_fold LIKE ${pattern} OR d.body_fold LIKE ${pattern})
          AND (NOT n.is_encrypted OR d.title_fold LIKE ${pattern})
          ORDER BY n.created_at DESC NULLS LAST, n.id DESC NULLS LAST LIMIT 25`
          const times: number[] = []
          for (let trial = 0; trial < 7; trial++) {
            const start = performance.now()
            await tx.execute(statement)
            times.push(performance.now() - start)
          }
          const explained = await tx.execute(
            sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${statement}`,
          )
          const explanation = explained[0]['QUERY PLAN'] as {
            Plan: Record<string, unknown>
            'Execution Time': number
          }[]
          const nodes: {
            type: unknown
            index?: unknown
            actualRows: unknown
            removedRows: unknown
          }[] = []
          function visit(node: Record<string, unknown>) {
            nodes.push({
              type: node['Node Type'],
              index: node['Index Name'],
              actualRows: node['Actual Rows'],
              removedRows: node['Rows Removed by Filter'],
            })
            for (const child of (node.Plans ?? []) as Record<string, unknown>[])
              visit(child)
          }
          visit(explanation[0].Plan)
          const warm = times.slice(1).sort((a, b) => a - b)
          results.push({
            indexed,
            query,
            firstMs: +times[0].toFixed(2),
            p50Ms: +warm[2].toFixed(2),
            p95Ms: +warm[5].toFixed(2),
            executionMs: explanation[0]['Execution Time'],
            indexes: nodes
              .filter((node) => node.index)
              .map((node) => node.index),
          })
          plans.push({indexed, query, nodes, plan: explanation[0]})
        }
        // Roll back the baseline's index drops; keep the identical dataset/indexes.
        if (!indexed) throw baselineRollback
      })
      .catch((error: unknown) => {
        if (error !== baselineRollback) throw error
      })
  }
  const sizes =
    await client`SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) AS total_size FROM pg_class WHERE relname IN ('notes','note_search_documents','note_search_body_trgm_idx','note_search_title_trgm_idx') ORDER BY relname`
  const search = createNoteSearchRepository(db)
  const endToEnd: unknown[] = []
  for (const query of ['selectivebeacon', '東京', '🚀', 'absent-query-zzzz']) {
    const start = performance.now()
    const page = await search.search(ownerId, query)
    endToEnd.push({
      query,
      ms: +(performance.now() - start).toFixed(2),
      rows: page.notes.length,
      responseBytes: Buffer.byteLength(JSON.stringify(page)),
    })
  }
  const writes: unknown[] = []
  const repo = createNoteRepository(db)
  for (const length of [2048, 65536, 200000]) {
    const body = `<p>${Array.from(
      {length: Math.ceil(length / 16)},
      (_, i) => words[i % words.length],
    )
      .join(' ')
      .slice(0, length)}</p>`
    const created = await repo.createNote(ownerId, {
      title: '<p>write benchmark</p>',
      content: body,
    })
    if (created.status !== 'success') throw new Error('Benchmark create failed')
    const times: number[] = []
    for (let trial = 0; trial < 5; trial++) {
      const start = performance.now()
      await repo.updateNote(ownerId, created.note.id, {
        content: `${body}<p>revision ${trial}</p>`,
      })
      times.push(performance.now() - start)
    }
    times.sort((a, b) => a - b)
    const themeTimes: number[] = []
    for (let trial = 0; trial < 5; trial++) {
      const start = performance.now()
      await repo.updateNote(ownerId, created.note.id, {
        theme: trial % 2 ? 'red' : 'blue',
      })
      themeTimes.push(performance.now() - start)
    }
    const current = (await repo.getNote(ownerId, created.note.id))!
    const request = {
      ownerId,
      noteId: current.id,
      creationId: randomUUID(),
      mutationId: randomUUID(),
      expectedRevision: current.revision,
      content: snapshot(current),
      kind: 'save' as const,
    }
    await repo.syncNote(ownerId, request)
    const retryTimes: number[] = []
    for (let trial = 0; trial < 5; trial++) {
      const start = performance.now()
      await repo.syncNote(ownerId, request)
      retryTimes.push(performance.now() - start)
    }
    themeTimes.sort((a, b) => a - b)
    retryTimes.sort((a, b) => a - b)
    writes.push({
      bodyChars: body.length,
      p50Ms: +times[2].toFixed(2),
      p95Ms: +times[4].toFixed(2),
      themeP50Ms: +themeTimes[2].toFixed(2),
      themeP95Ms: +themeTimes[4].toFixed(2),
      retryP50Ms: +retryTimes[2].toFixed(2),
      retryP95Ms: +retryTimes[4].toFixed(2),
    })
  }
  console.log(
    JSON.stringify({results, sizes, endToEnd, writes, plans}, null, 2),
  )
} finally {
  await client.end()
}
