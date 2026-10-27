'use client'

import {cn} from 'cn'
import type {Editor} from '@tiptap/react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import {useMessages, useTranslations} from 'next-intl'
import {NOTE_TITLE_MAX_LENGTH} from '~/db/schema/notes'
import {usePersistStore} from '~/store'
import {useRandomString} from '~/util/hooks'
import RTECommands from '~/components/ui/rte-commands'
import NoteEditor from './note-editor'

export default function NoteWriting({
  id,
  pending,
  fullPage = false,
  leadingActions,
  viewAction,
  navigationRef,
  onNavigationHandoffChange,
}: {
  id: string
  pending?: boolean
  fullPage?: boolean
  leadingActions?: ReactNode
  viewAction?: ReactNode
  navigationRef?: RefObject<HTMLElement | null>
  onNavigationHandoffChange?: (handedOff: boolean) => void
}) {
  const t = useTranslations('note.editor')
  const messages = useMessages()
  const placeholder = useRandomString(messages.note.editor.emptyPlaceholder)
  const draft = usePersistStore((state) => state.mutateNoteData)
  const update = usePersistStore((state) => state.setMutateNoteData)
  const body = useRef<Editor | null>(null)
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
    window.addEventListener('scroll', updateDocked, {passive: true})
    window.addEventListener('resize', updateDocked)
    const observer = new ResizeObserver(updateDocked)
    observer.observe(surface)
    if (navigationRef?.current) observer.observe(navigationRef.current)
    const title = document.getElementById(`${id}-title`)
    if (title) observer.observe(title)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateDocked)
      window.removeEventListener('resize', updateDocked)
      observer.disconnect()
    }
  }, [fullPage, id, navigationRef, onNavigationHandoffChange])
  const [active, setActive] = useState<{
    editor: Editor | null
    field: 'title' | 'body'
  }>({editor: null, field: 'title'})
  const readyTitle = useCallback(
    (editor: Editor) =>
      setActive((previous) =>
        !previous.editor || previous.editor.isDestroyed
          ? {editor, field: 'title'}
          : previous,
      ),
    [],
  )
  const focusTitle = useCallback(
    (editor: Editor) => setActive({editor, field: 'title'}),
    [],
  )
  const focusContent = useCallback(
    (editor: Editor) => setActive({editor, field: 'body'}),
    [],
  )
  const readyBody = useCallback((editor: Editor) => {
    body.current = editor
  }, [])
  const focusBody = useCallback(() => {
    body.current?.commands.focus('start')
  }, [])
  const toolbar = (
    <RTECommands
      editor={active.editor}
      disabled={pending}
      target={t(active.field)}
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
        key={`${id}-title`}
        id={`${id}-title`}
        className={fullPage ? 'my-4 px-4 sm:px-8' : 'p-4'}
        editorClassName="text-lg font-semibold sm:text-xl"
        initialValue={draft?.title}
        onChange={(title) => update({title})}
        onReady={readyTitle}
        onFocus={focusTitle}
        onPressEnter={focusBody}
        placeholder={t('title')}
        ariaLabel={t('title')}
        limitCharacter={NOTE_TITLE_MAX_LENGTH}
        showCount
        countClassName={fullPage ? 'text-ink-muted opacity-100' : undefined}
        disableDefaultEnter
        autofocus="end"
        loading={pending}
      />
      <div
        ref={bodySurface}
        className={cn(
          'flex flex-1 flex-col p-4',
          fullPage && 'pt-0 sm:m-4 sm:rounded-xl',
          fullPage && draft?.theme
            ? `dialog-${draft.theme}`
            : fullPage && 'sm:shadow-sheet',
        )}
      >
        {fullPage && toolbar}
        <NoteEditor
          key={`${id}-content`}
          id={`${id}-content`}
          className="flex flex-1 flex-col [&>div:has(.ProseMirror)]:flex-1"
          editorClassName="h-full min-h-64"
          initialValue={draft?.content}
          placeholder={placeholder}
          ariaLabel={t('body')}
          onReady={readyBody}
          onFocus={focusContent}
          onChange={(content) => update({content})}
          loading={pending}
          exposeStorage
        />
      </div>
    </>
  )
}
