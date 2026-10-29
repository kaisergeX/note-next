import assert from 'node:assert/strict'
import {test} from 'node:test'
import {diffText} from '../lib/notes/diff'

function sides(saved: string, mine: string) {
  const result = diffText(saved, mine)
  assert.equal(
    result.changes
      .filter((part) => !part.added)
      .map((part) => part.value)
      .join(''),
    saved,
  )
  assert.equal(
    result.changes
      .filter((part) => !part.removed)
      .map((part) => part.value)
      .join(''),
    mine,
  )
  return result
}

test('word changes preserve Vietnamese, punctuation, whitespace and both source texts', () => {
  const result = sides(
    'Ý tưởng cũ.\n\nViết tiếp!',
    'Ý tưởng mới.\n\nViết tiếp!',
  )
  assert.equal(result.coarse, false)
  assert.equal(result.changes.find((part) => part.removed)?.value, 'cũ')
  assert.equal(result.changes.find((part) => part.added)?.value, 'mới')
  sides('a\t b\n c', 'a  b\n\nc')
})

test('empty fields and unchanged content are represented without losing text', () => {
  sides('', 'New title')
  sides('Removed title', '')
  const result = sides('Same 👋🏽', 'Same 👋🏽')
  assert.equal(result.coarse, false)
  assert.equal(
    result.changes.some((part) => part.added || part.removed),
    false,
  )
})

test('unrelated and maximum-size notes use bounded whole-field fallback', () => {
  const unrelated = sides('before '.repeat(1500), 'after '.repeat(1500))
  assert.equal(unrelated.coarse, true)
  const large = sides('a'.repeat(262144), 'b'.repeat(262144))
  assert.equal(large.coarse, true)
  assert.equal(large.changes.length, 2)
})

test('markup-shaped text is treated only as text', () => {
  sides('<img src=x onerror=alert(1)> &', '<script>alert(2)</script>')
})
