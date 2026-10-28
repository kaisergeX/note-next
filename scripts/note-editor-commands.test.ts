import assert from 'node:assert/strict'
import {test} from 'node:test'
import {Editor, type JSONContent} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {insertNoteHorizontalRule} from '../lib/note-editor-commands'

const paragraph = (text = ''): JSONContent => ({
  type: 'paragraph',
  ...(text ? {content: [{type: 'text', text}]} : {}),
})
const rule = {type: 'horizontalRule'}
const heading = {
  type: 'heading',
  attrs: {level: 2},
  content: paragraph('Hello').content,
}
const quote = (content: JSONContent[]): JSONContent => ({
  type: 'blockquote',
  content,
})

for (const {name, content, position, expected, cursor} of [
  {
    name: 'end of heading preserves heading and starts a paragraph below the rule',
    content: [heading],
    position: 6,
    expected: [heading, rule, paragraph()],
    cursor: 9,
  },
  {
    name: 'end of a quoted paragraph keeps the insertion inside the quote',
    content: [quote([paragraph('Hello')])],
    position: 7,
    expected: [quote([paragraph('Hello'), rule, paragraph()])],
    cursor: 10,
  },
  {
    name: 'following rule gets a typing paragraph between the rules',
    content: [paragraph('Hello'), rule],
    position: 6,
    expected: [paragraph('Hello'), rule, paragraph(), rule],
    cursor: 9,
  },
  {
    name: 'end of document puts the empty paragraph after the rule',
    content: [paragraph('Hello')],
    position: 6,
    expected: [paragraph('Hello'), rule, paragraph()],
    cursor: 9,
  },
  {
    name: 'end of paragraph reuses the following text block',
    content: [paragraph('Hello'), paragraph('Next')],
    position: 6,
    expected: [paragraph('Hello'), rule, paragraph('Next')],
    cursor: 9,
  },
  {
    name: 'middle of paragraph still splits the text',
    content: [paragraph('Hello')],
    position: 3,
    expected: [paragraph('He'), rule, paragraph('llo')],
    cursor: 6,
  },
  {
    name: 'empty paragraph still becomes a rule and a typing paragraph',
    content: [paragraph()],
    position: 1,
    expected: [rule, paragraph()],
    cursor: 2,
  },
]) {
  test(name, () => {
    const editor = new Editor({
      element: null,
      extensions: [
        StarterKit.configure({
          link: false,
          listKeymap: false,
          trailingNode: false,
        }),
      ],
      content: {type: 'doc', content},
    })
    try {
      editor.commands.setTextSelection(position)
      assert.equal(editor.chain().command(insertNoteHorizontalRule).run(), true)
      assert.deepEqual(
        JSON.parse(JSON.stringify(editor.getJSON().content)),
        expected,
      )
      assert.equal(editor.state.selection.from, cursor)
      assert.equal(editor.state.selection.$from.parent.isTextblock, true)
    } finally {
      editor.destroy()
    }
  })
}
