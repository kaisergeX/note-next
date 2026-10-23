import assert from 'node:assert/strict'
import {test} from 'node:test'
import {performNoteMutation} from '../lib/notes/client-mutation'
import {noteMutationSucceeded} from '../lib/notes/lifecycle'

test('transport failures become retryable outcomes so callers retain drafts and items', async () => {
  const result = await performNoteMutation(async () => {
    throw new TypeError('Failed to fetch')
  })
  assert.deepEqual(result, {status: 'retryable_error'})
  assert.equal(noteMutationSucceeded(result), false)
})
test('server refusals remain failures rather than closing the editor as success', async () => {
  for (const status of [
    'unavailable',
    'invalid_input',
    'conflict',
    'retryable_error',
  ] as const) {
    const result = await performNoteMutation(async () => ({status}))
    assert.equal(result.status, status)
    assert.equal(noteMutationSucceeded(result), false)
  }
})
