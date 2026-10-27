'use client'

import {EditorContent, useEditor} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import {cn} from 'cn'
import {noteText} from '~/lib/notes/text'
import type {NoteTheme} from '~/db/schema/notes'

export default function NoteReadOnly({
  content,
  theme,
  className,
}: {
  content: string | null
  theme: NoteTheme | null
  className?: string
}) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          link: false,
          listKeymap: false,
          trailingNode: false,
        }),
        Highlight,
      ],
      content: content ?? '',
      editable: false,
      immediatelyRender: false,
      editorProps: {attributes: {tabindex: '-1'}},
    },
    [content],
  )
  return (
    <div
      className={cn(
        'prose max-w-prose wrap-anywhere',
        theme ? `prose-${theme}` : 'prose-appearance',
        className,
      )}
    >
      {editor ? <EditorContent editor={editor} /> : <p>{noteText(content)}</p>}
    </div>
  )
}
