'use client'

import {cn} from 'cn'
import CharacterCount from '@tiptap/extension-character-count'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import {
  EditorContent,
  Extension,
  useEditor,
  useEditorState,
  type Editor,
  type FocusPosition,
} from '@tiptap/react'
import type {Node} from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'
import {useEffect} from 'react'
import {EDITOR_CONTENT_LIMIT} from '~/config/note'
import {usePersistStore} from '~/store'
import {useDebounced} from '~/util/hooks'

type NoteEditorProps = {
  id: string
  initialValue?: string | null
  onChange?: (value: string, rawText?: string) => void
  onPressEnter?: () => void
  onReady?: (editor: Editor) => void
  onFocus?: (editor: Editor) => void
  className?: string
  editorClassName?: string
  placeholder?: string
  ariaLabel?: string
  showCount?: boolean
  countClassName?: string
  limitCharacter?: number
  disableDefaultEnter?: boolean
  autofocus?: FocusPosition
  loading?: boolean
  disabled?: boolean
  exposeStorage?: boolean
}

const countCache = new WeakMap<Node, {characters: number; words: number}>()
function documentCounts(editor: Editor | null) {
  if (!editor) return {characters: 0, words: 0}
  const doc = editor.state.doc
  let counts = countCache.get(doc)
  if (!counts) {
    counts = {
      characters: editor.storage.characterCount.characters(),
      words: editor.storage.characterCount.words(),
    }
    countCache.set(doc, counts)
  }
  return counts
}

// Content is loaded only when this field mounts for a document. Presentation
// and save-state changes update options on the same instance, never setContent.
export default function NoteEditor({
  id,
  initialValue = '',
  onChange,
  onPressEnter,
  onReady,
  onFocus,
  className,
  editorClassName,
  placeholder,
  ariaLabel,
  showCount,
  countClassName,
  limitCharacter,
  disableDefaultEnter = false,
  autofocus = false,
  loading = false,
  disabled = false,
  exposeStorage,
}: NoteEditorProps) {
  const theme = usePersistStore((state) => state.mutateNoteData?.theme)
  const editorVersion = usePersistStore(
    (state) => state.noteSession?.editorVersion ?? 0,
  )
  const setEditorCharCount = usePersistStore(
    (state) => state.setEditorCharCount,
  )
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
        listKeymap: false,
        trailingNode: false,
      }),
      CharacterCount.configure({limit: limitCharacter ?? EDITOR_CONTENT_LIMIT}),
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          'first:before:float-left first:before:content-[attr(data-placeholder)] first:before:pointer-events-none first:before:h-0',
      }),
      Highlight,
      Extension.create({
        name: 'titleEnter',
        addKeyboardShortcuts: () => ({
          Enter: () => {
            if (!disableDefaultEnter) return false
            onPressEnter?.()
            return true
          },
        }),
      }),
    ],
    editorProps: {
      attributes: {
        class: cn(
          'prose max-w-none focus:outline-none',
          theme ? `prose-${theme}` : 'prose-appearance',
          editorClassName,
        ),
        role: 'textbox',
        'aria-label': ariaLabel || placeholder || id,
        'aria-multiline': String(!disableDefaultEnter),
      },
    },
    content: initialValue || '',
    onUpdate: ({editor}) =>
      onChange?.(editor.isEmpty ? '' : editor.getHTML(), editor.getText()),
    onFocus: ({editor}) => onFocus?.(editor),
    editable: !disabled && !loading,
    autofocus,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
  })

  useEffect(() => {
    if (
      editorVersion &&
      editor &&
      editor.getHTML() !== (initialValue || '<p></p>')
    ) {
      editor.commands.setContent(initialValue || '', {emitUpdate: false})
    }
    // External updates are recovery/reconciliation, never acknowledgements.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, editorVersion])

  useEffect(() => {
    if (editor && editor.isEditable !== (!disabled && !loading)) {
      editor.setEditable(!disabled && !loading, false)
    }
  }, [editor, disabled, loading])

  useEffect(() => {
    if (editor) onReady?.(editor)
  }, [editor, onReady])

  // Cache by immutable document identity: selection-only transactions do not
  // scan the document or serialize HTML.
  const counts = useEditorState({
    editor,
    selector: ({editor}) => (editor ? documentCounts(editor) : null),
  })
  const currentCounts = counts ?? documentCounts(editor)
  const characters = currentCounts.characters
  const words = currentCounts.words
  const [debouncedCharacters] = useDebounced(characters, 400)
  const [debouncedWords] = useDebounced(words, 400)
  useEffect(() => {
    if (exposeStorage)
      setEditorCharCount(id, {
        characters: debouncedCharacters,
        words: debouncedWords,
      })
  }, [
    id,
    exposeStorage,
    setEditorCharCount,
    debouncedCharacters,
    debouncedWords,
  ])

  return (
    <div id={id} className={cn('group/field relative w-full', className)}>
      <EditorContent editor={editor} />
      {showCount && (
        <div
          className={cn(
            'border-hairline invisible absolute right-4 -bottom-4 z-10 text-right text-xs opacity-50 group-focus-within/field:visible',
            countClassName,
          )}
        >
          {characters}
          {limitCharacter ? ` / ${limitCharacter}` : ''}
        </div>
      )}
    </div>
  )
}
