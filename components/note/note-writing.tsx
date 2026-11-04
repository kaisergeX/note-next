'use client'

import {cn} from 'cn'
import type {Editor} from '@tiptap/react'
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import {useMessages, useTranslations} from 'next-intl'
import {NOTE_TITLE_MAX_LENGTH} from '~/db/schema/notes'
import {usePersistStore} from '~/store'
import type {NoteSnapshot} from '~/lib/notes/sync'
import {useRandomString} from '~/util/hooks'
import RTECommands from '~/components/ui/rte-commands'
import NoteEditor, {useNoteEditor} from './note-editor'

export function useNoteWriting(
  identity: string,
  draft: NoteSnapshot,
  pending: boolean,
  autofocus: boolean,
) {
  const t = useTranslations('note.editor')
  const messages = useMessages()
  const placeholder = useRandomString(messages.note.editor.emptyPlaceholder)
  const editorVersion = usePersistStore((state) =>
    state.noteSession?.identity === identity
      ? (state.noteSession.editorVersion ?? 0)
      : 0,
  )
  const [field, setField] = useState<'title' | 'body'>('title')
  const update = (value: {title: string} | {content: string}) => {
    const store = usePersistStore.getState()
    if (store.noteSession?.identity === identity) store.setMutateNoteData(value)
  }
  const body = useNoteEditor({
    initialValue: draft?.content,
    editorClassName: 'h-full min-h-64',
    placeholder,
    ariaLabel: t('body'),
    onFocus: () => setField('body'),
    onChange: (content) => update({content}),
    pending,
    theme: draft?.theme,
    editorVersion,
  })
  const title = useNoteEditor({
    initialValue: draft?.title,
    editorClassName: 'text-lg font-semibold sm:text-xl',
    placeholder: t('title'),
    ariaLabel: t('title'),
    limitCharacter: NOTE_TITLE_MAX_LENGTH,
    onFocus: () => setField('title'),
    onPressEnter: () => body?.commands.focus('start'),
    onChange: (title) => update({title}),
    autofocus: autofocus ? 'end' : false,
    pending,
    theme: draft?.theme,
    editorVersion,
  })
  return {title, body, field}
}

export type NoteWritingEditors = {
  title: Editor | null
  body: Editor | null
  field: 'title' | 'body'
}

export default function NoteWriting({
  id,
  editors,
  pending,
  fullPage = false,
  leadingActions,
  viewAction,
  navigationRef,
  onNavigationHandoffChange,
}: {
  id: string
  editors: NoteWritingEditors
  pending?: boolean
  fullPage?: boolean
  leadingActions?: ReactNode
  viewAction?: ReactNode
  navigationRef?: RefObject<HTMLElement | null>
  onNavigationHandoffChange?: (handedOff: boolean) => void
}) {
  const t = useTranslations('note.editor')
  const theme = usePersistStore((state) => state.mutateNoteData?.theme)
  const bodySurface = useRef<HTMLDivElement>(null)
  const [docked, setDocked] = useState(false)
  const [navigationHandedOff, setNavigationHandedOff] = useState(false)
  useEffect(() => {
    if (!fullPage) return
    const surface = bodySurface.current
    const toolbar = surface?.querySelector<HTMLElement>(
      '[data-editor-toolbar="fixed"]',
    )
    if (!surface || !toolbar) return
    const updateDocked = () => {
      const top = Number.parseFloat(getComputedStyle(toolbar).top) || 0
      const toolbarTop = toolbar.getBoundingClientRect().top
      setDocked(toolbarTop <= top)
      // offsetHeight stays stable while the header translates away. Using its
      // transformed bottom edge would make the handoff toggle back and forth.
      const navigationHeight = navigationRef?.current?.offsetHeight ?? 0
      const handedOff = toolbarTop <= top + navigationHeight
      setNavigationHandedOff(handedOff)
      onNavigationHandoffChange?.(handedOff)
    }
    const frame = requestAnimationFrame(updateDocked)
    // The full-page preview and embedded recovery surfaces can scroll inside
    // an element. Capture scrolls so the same header handoff works there too.
    window.addEventListener('scroll', updateDocked, {
      passive: true,
      capture: true,
    })
    window.addEventListener('resize', updateDocked)
    const observer = new ResizeObserver(updateDocked)
    observer.observe(surface)
    if (navigationRef?.current) observer.observe(navigationRef.current)
    const title = document.getElementById(`${id}-title`)
    if (title) observer.observe(title)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateDocked, true)
      window.removeEventListener('resize', updateDocked)
      observer.disconnect()
    }
  }, [fullPage, id, navigationRef, onNavigationHandoffChange])
  const toolbar = (
    <RTECommands
      editor={editors[editors.field]}
      disabled={pending}
      target={t(editors.field)}
      layout={fullPage ? 'document' : 'dialog'}
      docked={docked}
      leadingActions={
        fullPage ? (
          <div
            className={cn(
              'shrink-0 overflow-hidden transition-all duration-200 ease-out motion-reduce:transition-none',
              navigationHandedOff
                ? 'w-14 translate-x-0 opacity-100'
                : 'w-0 -translate-x-2 opacity-0',
            )}
            inert={!navigationHandedOff}
            aria-hidden={!navigationHandedOff}
          >
            <div className="flex w-max items-center gap-2">
              {leadingActions}
              <span className="bg-hairline-strong h-5 w-px" aria-hidden />
            </div>
          </div>
        ) : (
          leadingActions
        )
      }
      viewAction={
        fullPage ? (
          <div
            className={cn(
              'shrink-0 overflow-hidden transition-all duration-200 ease-out motion-reduce:transition-none max-sm:hidden',
              navigationHandedOff
                ? 'w-10 translate-x-0 opacity-100'
                : 'w-0 translate-x-2 opacity-0',
            )}
            inert={!navigationHandedOff}
            aria-hidden={!navigationHandedOff}
          >
            {viewAction}
          </div>
        ) : (
          viewAction
        )
      }
    />
  )
  return (
    <>
      {!fullPage && toolbar}
      <NoteEditor
        id={`${id}-title`}
        editor={editors.title}
        className={fullPage ? 'my-4 px-4 sm:px-8' : 'p-4'}
        limitCharacter={NOTE_TITLE_MAX_LENGTH}
        showCount
        countClassName={fullPage ? 'text-ink-muted opacity-100' : undefined}
      />
      <div
        ref={bodySurface}
        className={cn(
          'flex flex-1 flex-col p-4',
          fullPage && 'pt-0 sm:m-4 sm:rounded-xl',
          fullPage && theme ? `dialog-${theme}` : fullPage && 'sm:shadow-sheet',
        )}
      >
        {fullPage && toolbar}
        <NoteEditor
          id={`${id}-content`}
          editor={editors.body}
          className="flex flex-1 flex-col [&>div:has(.ProseMirror)]:flex-1"
          exposeStorage
        />
      </div>
    </>
  )
}
