'use client'

import {
  Extension,
  useEditor,
  EditorContent,
  BubbleMenu,
  FloatingMenu,
} from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import CharacterCount, {
  type CharacterCountStorage,
} from '@tiptap/extension-character-count'
import {classNames} from '~/util'
import {DB_TEXT_LIMIT} from '~/db'
import RTECommands, {type RTECommandsProps} from '../ui/rte-commands'
import {PluginKey} from '@tiptap/pm/state'

type NoteEditorProps = {
  id: string
  initialValue?: string | null
  onChange?: (value: string, rawText?: string) => void

  className?: string
  editorClassName?: string
  placeholder?: string
  limitCharacter?: number

  commandTypes?: RTECommandsProps['menuType']
  showCount?: boolean
  disableEnter?: boolean
}

export default function NoteEditor({
  id,
  initialValue = '',
  onChange,

  placeholder,
  className = '',
  editorClassName = '',
  limitCharacter = DB_TEXT_LIMIT,

  commandTypes,
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
      if (!onChange) {
        return
      }

      const rawText = editor.getText()
      if (!rawText) {
        onChange('')
        return
      }

      onChange(editor.getHTML(), rawText)
    },
  })

  if (!textEditor) {
    return <></>
  }

  const renderCommands = () => {
    switch (commandTypes) {
      case 'fixed':
        return (
          <RTECommands
            className="glass invisible sticky inset-x-0 top-16 z-40 -mx-4 -mt-8 bg-inherit px-4 
            group-focus-within/rteditor:visible group-focus-within/rteditor:mt-0 group-focus-within/rteditor:pt-4"
            editor={textEditor}
            menuType={commandTypes}
          />
        )

      case 'bubble':
        return (
          <BubbleMenu
            pluginKey={new PluginKey(id)}
            className="glass rounded-lg px-2"
            editor={textEditor}
            tippyOptions={{duration: 100}}
          >
            <RTECommands editor={textEditor} menuType={commandTypes} />
          </BubbleMenu>
        )

      case 'floating':
        return (
          <FloatingMenu
            pluginKey={new PluginKey(id)}
            className="bg-default rounded-lg"
            editor={textEditor}
            tippyOptions={{duration: 100}}
          >
            <RTECommands editor={textEditor} menuType={commandTypes} />
          </FloatingMenu>
        )

      default:
        return <></>
    }
  }

  return (
    <div
      id={id}
      className={classNames(
        'group/rteditor relative w-full [overflow-wrap:anywhere]',
        className,
      )}
    >
      {renderCommands()}
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
