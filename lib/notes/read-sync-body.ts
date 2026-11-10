export const SYNC_BODY_BYTE_LIMIT = 1100000

// null means the wire payload exceeded the limit; read failures still throw.
export async function readSyncBody(request: Pick<Request, 'body'>) {
  if (!request.body) return ''
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const {done, value} = await reader.read()
      if (done) return text + decoder.decode()
      bytes += value.byteLength
      if (bytes > SYNC_BODY_BYTE_LIMIT) {
        // Do not wait for the producer's cancellation cleanup to reply with 413.
        void reader.cancel().catch(() => {})
        return null
      }
      text += decoder.decode(value, {stream: true})
    }
  } finally {
    reader.releaseLock()
  }
}
