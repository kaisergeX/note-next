'use client'

import {
  Extension,
  useEditor,
  EditorContent,
  BubbleMenu,
  FloatingMenu,
  type FocusPosition,
} from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import CharacterCount, {
  type CharacterCountStorage,
} from '@tiptap/extension-character-count'
import {classNames} from '~/util'
import {DB_TEXT_LIMIT} from '~/db'
import RTECommands from '../ui/rte-commands'
import {PluginKey} from '@tiptap/pm/state'
import Highlight from '@tiptap/extension-highlight'

type NoteEditorProps = {
  id: string
  initialValue?: string | null
  onChange?: (value: string, rawText?: string) => void

  className?: string
  menuClassNames?: {
    fixedMenu?: string
    bubbleMenu?: string
    floatingMenu?: string
  }
  editorClassName?: string
  placeholder?: string
  limitCharacter?: number

  commandTypes?: 'always-fixed' | 'fixed' | 'bubble-floating' | 'all'
  showCount?: boolean
  disableEnter?: boolean
  tabIndex?: string
  autofocus?: FocusPosition
  loading?: boolean
  disabled?: boolean
}

export default function NoteEditor({
  id,
  initialValue = '',
  onChange,

  placeholder,
  className = '',
  menuClassNames,
  editorClassName = '',
  limitCharacter = Math.floor(DB_TEXT_LIMIT / 3),

  commandTypes,
  showCount = false,
  disableEnter = false,
  tabIndex = '',
  autofocus = false,
  loading,
  disabled,
}: NoteEditorProps) {
  const DisableEnter = Extension.create({
    name: 'disableEnter',
    addKeyboardShortcuts: () => ({Enter: () => disableEnter}),
  })

  const textEditor = useEditor(
    {
      extensions: [
        StarterKit,
        CharacterCount.configure({limit: limitCharacter}),
        Placeholder.configure({
          placeholder,
          emptyNodeClass:
            'first:before:opacity-50 first:before:float-left first:before:content-[attr(data-placeholder)] first:before:pointer-events-none first:before:h-0',
        }),
        Highlight,
        DisableEnter,
      ],
      editorProps: {
        attributes: {
          class: classNames(
            'focus:outline-none prose max-w-none dark:prose-invert [overflow-wrap:anywhere]',
            loading ? 'opacity-80 cursor-progress' : '',
            editorClassName,
          ),
          tabindex: tabIndex,
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
      editable: !disabled && !loading,
      injectCSS: false,
      autofocus: autofocus,
    },
    [id, initialValue, disabled],
  )

  if (!textEditor) {
    return <></>
  }

  const renderFixedMenu = (
    <RTECommands
      className={classNames(
        'sticky inset-x-0 z-10 -mx-4 p-4',
        commandTypes === 'always-fixed'
          ? 'bg-default top-16'
          : 'glass invisible top-14 bg-inherit group-focus-within/rteditor:visible group-focus-within/rteditor:mt-0 group-focus-within/rteditor:pt-4',
        menuClassNames?.fixedMenu || '',
      )}
      editor={textEditor}
      menuType="fixed"
    />
  )

  const renderBubbleFloatingMenu = (
    <>
      <BubbleMenu
        pluginKey={new PluginKey(id)}
        className={classNames(
          'bg-default shadow-theme rounded-lg p-2',
          menuClassNames?.bubbleMenu || '',
        )}
        editor={textEditor}
        tippyOptions={{duration: 100}}
      >
        <RTECommands className="!mb-0" editor={textEditor} menuType="bubble" />
      </BubbleMenu>

      <FloatingMenu
        pluginKey={new PluginKey(id)}
        className={classNames(
          'bg-default rounded-lg',
          menuClassNames?.floatingMenu || '',
        )}
        editor={textEditor}
        tippyOptions={{duration: 100}}
      >
        <RTECommands
          className="!mb-0"
          editor={textEditor}
          menuType="floating"
        />
      </FloatingMenu>
    </>
  )

  const renderCommands = () => {
    switch (commandTypes) {
      case 'fixed':
        return renderFixedMenu

      case 'always-fixed':
        return renderFixedMenu

      case 'bubble-floating':
        return renderBubbleFloatingMenu

      case 'all':
        return (
          <>
            {renderFixedMenu}
            {renderBubbleFloatingMenu}
          </>
        )

      default:
        return <></>
    }
  }

  return (
    <div
      id={id}
      className={classNames('group/rteditor relative w-full', className)}
    >
      {renderCommands()}
      <EditorContent editor={textEditor} />
      {showCount && (
        <div className="invisible absolute -bottom-4 right-4 border-gray-100 text-right text-xs opacity-50 group-focus-within/rteditor:visible">
          {(
            textEditor.storage.characterCount as CharacterCountStorage
          ).characters()}{' '}
          / {limitCharacter}
        </div>
      )}
    </div>
  )
}
