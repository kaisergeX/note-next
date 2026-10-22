'use client'

import {cn} from 'cn'
import CharacterCount, {
  type CharacterCountStorage,
} from '@tiptap/extension-character-count'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import {PluginKey} from '@tiptap/pm/state'
import {
  BubbleMenu,
  EditorContent,
  Extension,
  FloatingMenu,
  useEditor,
  type FocusPosition,
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {useEffect, type ReactNode} from 'react'
import {EDITOR_CONTENT_LIMIT} from '~/config/note'
import {usePersistStore} from '~/store'
import {useDebounced} from '~/util/hooks'
import RTECommands from '../ui/rte-commands'

type NoteEditorProps = {
  id: string
  initialValue?: string | null
  onChange?: (value: string, rawText?: string) => void
  onPressEnter?: () => void

  className?: string
  menuClassNames?: {
    fixedMenu?: string
    bubbleMenu?: string
    floatingMenu?: string
  }
  editorClassName?: string
  defaultTheme?: boolean

  placeholder?: string
  showCount?: boolean
  countClassName?: string
  limitCharacter?: number

  commandTypes?: 'always-fixed' | 'fixed' | 'bubble-floating' | 'all'
  compactToolbar?: boolean
  toolbarLeading?: ReactNode
  toolbarTrailing?: ReactNode
  disableDefaultEnter?: boolean
  tabIndex?: string
  autofocus?: FocusPosition
  loading?: boolean
  disabled?: boolean

  exposeStorage?: boolean
}

export default function NoteEditor({
  id,
  initialValue = '',
  onChange,
  onPressEnter,

  className = '',
  menuClassNames,
  editorClassName = '',
  defaultTheme = false,

  placeholder,
  showCount = false,
  countClassName = '',
  limitCharacter,

  commandTypes,
  compactToolbar = false,
  toolbarLeading,
  toolbarTrailing,
  disableDefaultEnter = false,
  tabIndex = '',
  autofocus = false,
  loading,
  disabled,

  exposeStorage,
}: NoteEditorProps) {
  const [setEditorCharCount, noteTheme] = usePersistStore((state) => [
    state.setEditorCharCount,
    state.mutateNoteData?.theme,
  ])
  const theme = defaultTheme ? undefined : noteTheme

  const DisableEnter = Extension.create({
    name: 'disableEnter',
    addKeyboardShortcuts: () => ({
      Enter: () => {
        onPressEnter?.()
        return disableDefaultEnter
      },
    }),
  })

  const textEditor = useEditor(
    {
      extensions: [
        StarterKit,
        CharacterCount.configure({
          limit: limitCharacter || EDITOR_CONTENT_LIMIT,
        }),
        Placeholder.configure({
          placeholder,
          emptyEditorClass:
            'first:before:float-left first:before:content-[attr(data-placeholder)] first:before:pointer-events-none first:before:h-0',
        }),
        Highlight,
        DisableEnter,
      ],
      editorProps: {
        attributes: {
          class: cn(
            'focus:outline-none prose max-w-none',
            theme ? `prose-${theme}` : 'prose-appearance',
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
      autofocus: autofocus,
      immediatelyRender: false,
    },
    [id, theme, loading, disabled],
  )

  const charCountStorage = textEditor?.storage?.characterCount as
    CharacterCountStorage | undefined
  const characterCount = charCountStorage?.characters() || 0
  const wordCount = charCountStorage?.words() || 0
  const [characterCountDebounced] = useDebounced(characterCount, 400)
  const [wordCountDebounced] = useDebounced(wordCount, 400)

  useEffect(() => {
    if (exposeStorage) {
      setEditorCharCount(id, {
        characters: characterCountDebounced,
        words: wordCountDebounced,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterCountDebounced, wordCountDebounced])

  if (!textEditor) {
    return <></>
  }

  const renderFixedMenu = (
    <RTECommands
      className={cn(
        'sticky inset-x-0 z-10 -mx-4 p-4',
        commandTypes === 'always-fixed'
          ? 'bg-paper-raised border-hairline top-16 border'
          : 'bg-paper/70 invisible top-14 bg-inherit backdrop-blur-sm group-focus-within/rteditor:visible group-focus-within/rteditor:mt-0 group-focus-within/rteditor:pt-4',
        menuClassNames?.fixedMenu || '',
      )}
      editor={textEditor}
      menuType="fixed"
      compact={compactToolbar}
      leadingActions={toolbarLeading}
      trailingActions={toolbarTrailing}
    />
  )

  const renderBubbleFloatingMenu = (
    <>
      <BubbleMenu
        pluginKey={new PluginKey(id)}
        className={cn(
          'bg-paper-raised border-hairline shadow-sheet rounded-lg border p-2',
          menuClassNames?.bubbleMenu || '',
        )}
        editor={textEditor}
        tippyOptions={{duration: 100}}
      >
        <RTECommands editor={textEditor} menuType="bubble" />
      </BubbleMenu>

      <FloatingMenu
        pluginKey={new PluginKey(id)}
        className={cn(
          'bg-paper-raised border-hairline ml-4 rounded-lg border',
          menuClassNames?.floatingMenu || '',
        )}
        editor={textEditor}
        tippyOptions={{duration: 100}}
      >
        <RTECommands editor={textEditor} menuType="floating" />
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
    <div id={id} className={cn('group/rteditor relative w-full', className)}>
      {renderCommands()}
      <EditorContent editor={textEditor} />
      {showCount && (
        <div
          className={cn(
            'border-hairline invisible absolute right-4 -bottom-4 text-right text-xs opacity-50 group-focus-within/rteditor:visible',
            countClassName,
          )}
        >
          {characterCount}
          {limitCharacter ? ` / ${limitCharacter}` : ''}
        </div>
      )}
    </div>
  )
}
