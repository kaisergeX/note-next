import assert from 'node:assert/strict'
import {test} from 'node:test'
import {
  meaningfulContent,
  reconcile,
  sameContent,
  snapshot,
} from '../lib/notes/sync'

test('empty documents and theme choices do not create notes; structural rules do', () => {
  for (const content of ['', '<p></p>', '<p><br></p>', '<p>&nbsp;</p>'])
    assert.equal(meaningfulContent({content, theme: 'green'}), false)
  assert.equal(meaningfulContent({content: '<hr><p></p>'}), true)
  assert.equal(meaningfulContent({title: '<p>Ý tưởng</p>'}), true)
})

test('independent title, body and theme changes reconcile without dropping a side', () => {
  const base = {title: 'Title', content: 'Body', theme: null}
  const local = snapshot({...base, content: 'Local body'})
  const remote = snapshot({...base, title: 'Remote title', theme: 'green'})
  assert.deepEqual(reconcile(base, local, remote), {
    merged: {title: 'Remote title', content: 'Local body', theme: 'green'},
    conflicts: [],
  })
})

test('same-field conflict preserves current local content and identifies review fields', () => {
  const base = snapshot({title: 'Title', content: 'Body'})
  const local = {...base, content: '<p>Mine</p>'}
  const remote = {...base, content: '<p>Saved elsewhere</p>'}
  assert.deepEqual(reconcile(base, local, remote), {
    merged: local,
    conflicts: ['content'],
  })
  assert.deepEqual(reconcile(base, local, local), {
    merged: local,
    conflicts: [],
  })
})

test('empty optional fields compare consistently without erasing structural HTML', () => {
  assert.equal(sameContent({title: '', content: null}, {title: null}), true)
  assert.equal(sameContent({content: '<hr>'}, {}), false)
})
