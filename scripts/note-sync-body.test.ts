import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readSyncBody, SYNC_BODY_BYTE_LIMIT} from '../lib/notes/read-sync-body'

const encoder = new TextEncoder()

function streamedRequest(chunks: Uint8Array[], contentLength?: string) {
  let pulls = 0
  let cancelled = false
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        const chunk = chunks[pulls++]
        if (chunk) controller.enqueue(chunk)
        else controller.close()
      },
      cancel() {
        cancelled = true
      },
    },
    {highWaterMark: 0},
  )
  const request = new Request('http://localhost/api/note/sync', {
    method: 'POST',
    body,
    duplex: 'half',
    headers: contentLength ? {'Content-Length': contentLength} : {},
  } as RequestInit)
  return {request, pulls: () => pulls, cancelled: () => cancelled}
}

test('sync body accepts exactly 1,100,000 wire bytes', async () => {
  assert.equal(SYNC_BODY_BYTE_LIMIT, 1100000)
  const text = JSON.stringify({content: 'a'.repeat(1100000 - 14)})
  assert.equal(encoder.encode(text).byteLength, 1100000)
  const stream = streamedRequest([
    encoder.encode(text.slice(0, 500000)),
    encoder.encode(text.slice(500000)),
  ])
  assert.equal(await readSyncBody(stream.request), text)
  assert.equal(stream.cancelled(), false)
  assert.equal(stream.request.body!.locked, false)
})

for (const length of [undefined, '1', 'invalid']) {
  test(`sync body stops at first overflow with Content-Length ${length}`, async () => {
    const stream = streamedRequest(
      [new Uint8Array(1100000), new Uint8Array(1), new Uint8Array(100)],
      length,
    )
    assert.equal(await readSyncBody(stream.request), null)
    assert.equal(stream.pulls(), 2, 'must not pull the remaining body')
    assert.equal(stream.cancelled(), true)
    assert.equal(stream.request.body!.locked, false)
  })
}

test('sync body preserves UTF-8 split across chunks and Request.text decoding', async () => {
  const bytes = encoder.encode('\uFEFF{"content":"Ý tưởng 😀"}')
  const stream = streamedRequest(
    Array.from(bytes, (byte) => new Uint8Array([byte])),
  )
  const text = await readSyncBody(stream.request)
  assert.equal(text, await new Response(bytes).text())
  assert.deepEqual(JSON.parse(text!), {content: 'Ý tưởng 😀'})
})

test('sync body counts UTF-8 wire bytes rather than decoded characters', async () => {
  const stream = streamedRequest([
    encoder.encode('a'.repeat(1099998)),
    encoder.encode('😀'),
    encoder.encode('unread'),
  ])
  assert.equal(await readSyncBody(stream.request), null)
  assert.equal(stream.pulls(), 2)
  assert.equal(stream.cancelled(), true)
})

test('sync body handles empty bodies and flushes incomplete UTF-8 like Request.text', async () => {
  assert.equal(await readSyncBody(new Request('http://localhost')), '')
  const bytes = new Uint8Array([0xe2, 0x82])
  const stream = streamedRequest([bytes])
  assert.equal(
    await readSyncBody(stream.request),
    await new Response(bytes).text(),
  )
})

test('sync body propagates read failures and releases the reader', async () => {
  const failure = new Error('read failed')
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
    pull(controller) {
      controller.error(failure)
    },
  })
  await assert.rejects(readSyncBody({body}), (error) => error === failure)
  assert.equal(body.locked, false)
})
