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
import {useEffect, useLayoutEffect, useRef} from 'react'
import {EDITOR_CONTENT_LIMIT} from '~/config/note'
import type {NoteTheme} from '~/db/schema/notes'
import {usePersistStore} from '~/store'
import {useDebounced} from '~/util/hooks'

type NoteEditorOptions = {
  initialValue?: string | null
  onChange: (value: string) => void
  onPressEnter?: () => void
  onFocus: () => void
  editorClassName?: string
  placeholder: string
  ariaLabel: string
  limitCharacter?: number
  autofocus?: FocusPosition
  pending?: boolean
  readOnly?: boolean
  theme?: NoteTheme | null
  editorVersion: number
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

export function useNoteEditor({
  initialValue = '',
  onChange,
  onPressEnter,
  onFocus,
  editorClassName,
  placeholder,
  ariaLabel,
  limitCharacter,
  autofocus = false,
  pending = false,
  readOnly = false,
  theme,
  editorVersion,
}: NoteEditorOptions) {
  const enter = useRef(onPressEnter)
  useLayoutEffect(() => {
    enter.current = onPressEnter
  }, [onPressEnter])
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
            if (!enter.current) return false
            enter.current()
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
        'aria-label': ariaLabel,
        'aria-multiline': String(!onPressEnter),
        'aria-readonly': String(readOnly),
      },
    },
    content: initialValue || '',
    onUpdate: ({editor}) => onChange(editor.isEmpty ? '' : editor.getHTML()),
    onFocus,
    editable: !pending && !readOnly,
    autofocus: readOnly ? false : autofocus,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
  })

  useEffect(() => {
    if (
      editorVersion &&
      editor &&
      editor.getHTML() !== (initialValue || '<p></p>')
    ) {
      editor
        .chain()
        .setMeta('addToHistory', false)
        .setContent(initialValue || '', {emitUpdate: false})
        .run()
    }
    // External updates are recovery/reconciliation, never acknowledgements.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, editorVersion])

  useEffect(() => {
    const editable = !pending && !readOnly
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable, false)
    }
  }, [editor, pending, readOnly])

  return editor
}

export default function NoteEditor({
  id,
  editor,
  className,
  showCount,
  countClassName,
  limitCharacter,
  exposeStorage,
}: {
  id: string
  editor: Editor | null
  className?: string
  showCount?: boolean
  countClassName?: string
  limitCharacter?: number
  exposeStorage?: boolean
}) {
  const setEditorCharCount = usePersistStore(
    (state) => state.setEditorCharCount,
  )

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
