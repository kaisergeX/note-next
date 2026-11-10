export async function readEncryptionBody(
  request: Pick<Request, 'body' | 'headers'>,
  limit = 1500000,
): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > limit)
    throw new RangeError('Body too large')
  if (!request.body) throw new SyntaxError('Empty body')
  const reader = request.body.getReader()
  const decoder = new TextDecoder('utf-8', {fatal: true})
  let bytes = 0,
    text = ''
  try {
    while (true) {
      const {done, value} = await reader.read()
      if (done) return JSON.parse(text + decoder.decode())
      bytes += value.byteLength
      if (bytes > limit) {
        void reader.cancel().catch(() => {})
        throw new RangeError('Body too large')
      }
      text += decoder.decode(value, {stream: true})
    }
  } finally {
    reader.releaseLock()
  }
}
