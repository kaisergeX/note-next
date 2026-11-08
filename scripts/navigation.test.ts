import assert from 'node:assert/strict'
import {test} from 'node:test'
import {parentPagePath} from '../lib/navigation'

const persona = '01234567-89ab-cdef-0123-456789abcdef'

test('missing pages return to known parents and retain the URL locale', () => {
  for (const [path, parent] of [
    ['/en/full/eton/missing', '/en/eton'],
    ['/vi/eton/missing', '/vi/eton'],
    ['/vi/collection/missing', '/vi/eton'],
    ['/en/ai/interview/runs/missing', '/en/ai/interview/runs'],
    [`/vi/ai/interview/${persona}/edit`, `/vi/ai/interview/${persona}`],
    ['/vi/ai/interview/invalid/chat', '/vi/ai/interview'],
    ['/en/settings/missing', '/en/settings'],
    ['/vi/missing/deep/page', '/vi/'],
    ['/unknown', '/'],
  ]) {
    assert.equal(parentPagePath(path), parent, path)
  }
})
