import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readEncryptionBody} from '../lib/notes/encryption/read-body'
const bytes = (value: string) => new TextEncoder().encode(value)
test('bounds actual streamed bytes with no content length before JSON buffering', async () => {
  let cancelled = false
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.enqueue(bytes('{"a":"'))
      controller.enqueue(bytes('x'.repeat(100)))
    },
    cancel() {
      cancelled = true
    },
  })
  await assert.rejects(
    readEncryptionBody({body, headers: new Headers()}, 16),
    RangeError,
  )
  assert.equal(cancelled, true)
})
test('checks declared size, UTF-8 bytes, malformed UTF-8 and strict JSON', async () => {
  await assert.rejects(
    readEncryptionBody(
      {body: null, headers: new Headers({'content-length': '100'})},
      10,
    ),
    RangeError,
  )
  const stream = (value: Uint8Array<ArrayBuffer>) =>
    new ReadableStream<Uint8Array<ArrayBuffer>>({
      start(c) {
        c.enqueue(value)
        c.close()
      },
    })
  await assert.rejects(
    readEncryptionBody(
      {body: stream(bytes('"世界"')), headers: new Headers()},
      5,
    ),
    RangeError,
  )
  await assert.rejects(
    readEncryptionBody({
      body: stream(new Uint8Array([255])),
      headers: new Headers(),
    }),
    TypeError,
  )
  await assert.rejects(
    readEncryptionBody({body: stream(bytes('{')), headers: new Headers()}),
    SyntaxError,
  )
  assert.deepEqual(
    await readEncryptionBody({
      body: stream(bytes('{"ok":true}')),
      headers: new Headers(),
    }),
    {ok: true},
  )
})
