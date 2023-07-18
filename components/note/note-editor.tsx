'use client'

import {Extension, useEditor, EditorContent} from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import CharacterCount, {
  type CharacterCountStorage,
} from '@tiptap/extension-character-count'
import {classNames} from '~/util'
import {DB_TEXT_LIMIT} from '~/db'

type NoteEditorProps = {
  initialValue?: string | null
  onChange?: (value: string) => void

  className?: string
  editorClassName?: string
  placeholder?: string
  limitCharacter?: number
  showCount?: boolean
  disableEnter?: boolean
}

export default function NoteEditor({
  initialValue = '',
  onChange,

  placeholder,
  className = '',
  editorClassName = '',
  limitCharacter = DB_TEXT_LIMIT,
  showCount = false,
  disableEnter = false,
}: NoteEditorProps) {
  const DisableEnter = Extension.create({
    name: 'disableEnter',
    addKeyboardShortcuts: () => ({Enter: () => disableEnter}),
  })

  const textEditor = useEditor({
    extensions: [
      StarterKit,
      CharacterCount.configure({limit: limitCharacter}),
      Placeholder.configure({
        placeholder,
        emptyNodeClass:
          'first:before:opacity-50 first:before:float-left first:before:content-[attr(data-placeholder)] first:before:pointer-events-none first:before:h-0',
      }),
      DisableEnter,
    ],
    editorProps: {
      attributes: {
        class: classNames(
          'focus:outline-none prose max-w-none dark:prose-invert',
          editorClassName,
        ),
      },
    },
    content: initialValue || '',
    onUpdate({editor}) {
      onChange?.(editor.getHTML())
    },
  })

  if (!textEditor) {
    return <></>
  }

  return (
    <div
      className={classNames(
        'group/rteditor relative w-full [overflow-wrap:anywhere]',
        className,
      )}
    >
      <EditorContent editor={textEditor} />
      {showCount && (
        <div className="invisible absolute -bottom-4 right-4 border-gray-100 text-right text-xs opacity-50 group-focus-within/rteditor:visible">
          {(
            textEditor.storage.characterCount as CharacterCountStorage
          ).characters()}{' '}
          / 255
        </div>
      )}
    </div>
  )
}
