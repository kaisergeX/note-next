'use client'

import {cn} from 'cn'
import {
  IconArrowLeft,
  IconWindowMaximize,
  IconWindowMinimize,
} from '@tabler/icons-react'
import {useMessages, useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {useEffect, useLayoutEffect, useState, useTransition} from 'react'
import Button from '~/components/ui/button'
import NoteCustomize from '~/components/note/note-customize'
import NoteEditor from '~/components/note/note-editor'
import {type Note, NOTE_TITLE_MAX_LENGTH} from '~/db/schema/notes'
import {usePersistStore} from '~/store'
import {isEqualNonNestedObj} from '~/util'
import {useFullscreen, useRandomString, useWindowScroll} from '~/util/hooks'
import {mutateNoteAction} from '../actions'

type NoteDetailProps = {noteData: Note}

export default function NoteDetail({noteData}: NoteDetailProps) {
  const router = useRouter()
  const [scroll, _, {viewY, maxViewY}] = useWindowScroll()
  const [isPending, startTransition] = useTransition()
  const [isToolbarDocked, setIsToolbarDocked] = useState(false)
  const {isFullscreen, toggleFullscreen, error: fullscreenErr} = useFullscreen()
  const {mutateNoteData, setMutateNoteData, editorCharCount} = usePersistStore()
  const t = useTranslations('note')
  const messages = useMessages()
  const emptyPlaceholders = useRandomString(
    messages.note.editor.emptyPlaceholder,
  )

  const theme = mutateNoteData?.theme

  const contentCount = {
    words: editorCharCount['note-content']?.words || 0,
    characters: editorCharCount['note-content']?.characters || 0,
  }

  const handleSubmit = () =>
    startTransition(async () => {
      if (
        mutateNoteData &&
        !isEqualNonNestedObj(noteData, mutateNoteData, [
          'createdAt',
          'updatedAt',
          'pendingDeleteAt',
        ])
      ) {
        await mutateNoteAction(noteData.id, mutateNoteData)
      }

      window.history.length > 1 ? router.back() : router.push('/eton')
    })

  useEffect(() => {
    return () => setMutateNoteData(undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    setMutateNoteData(noteData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const updateToolbarDocked = () => {
      const toolbar = document
        .getElementById('note-content')
        ?.querySelector<HTMLElement>('[data-editor-toolbar="fixed"]')
      if (!toolbar) return

      const stickyTop = Number.parseFloat(getComputedStyle(toolbar).top) || 0
      setIsToolbarDocked(toolbar.getBoundingClientRect().top <= stickyTop)
    }

    const frame = requestAnimationFrame(updateToolbarDocked)
    window.addEventListener('scroll', updateToolbarDocked, {passive: true})
    window.addEventListener('resize', updateToolbarDocked)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateToolbarDocked)
      window.removeEventListener('resize', updateToolbarDocked)
    }
  }, [])

  return (
    <main className="relative flex flex-1 flex-col">
      <section
        className={cn(
          'bg-paper/70 flex-center-between sticky top-0 z-40 gap-4 px-4 py-3 backdrop-blur-sm transition-all duration-200 ease-out motion-reduce:transition-none',
          isToolbarDocked
            ? 'pointer-events-none -translate-y-full opacity-0'
            : 'translate-y-0 opacity-100',
        )}
        inert={isToolbarDocked}
        aria-hidden={isToolbarDocked}
      >
        <Button
          iconOnly
          variant="ghost"
          onClick={handleSubmit}
          disabled={isPending}
          aria-label="Save and go back"
        >
          <IconArrowLeft />
        </Button>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            iconOnly
            title="Toggle fullscreen"
            className="max-sm:hidden"
            onClick={() => void toggleFullscreen()}
            disabled={fullscreenErr}
            aria-label="Toggle fullscreen"
          >
            {isFullscreen ? <IconWindowMinimize /> : <IconWindowMaximize />}
          </Button>
        </div>
      </section>

      <div className="flex w-full flex-1 flex-col">
        <NoteEditor
          id="note-title"
          className="my-4 px-4 sm:px-8"
          editorClassName="text-lg font-semibold sm:text-xl"
          initialValue={mutateNoteData?.title || noteData?.title || ''}
          onChange={(value) => setMutateNoteData({title: value})}
          placeholder="Title"
          limitCharacter={NOTE_TITLE_MAX_LENGTH}
          showCount
          countClassName="text-ink-muted opacity-100"
          disableDefaultEnter
          autofocus="end"
          loading={isPending}
        />

        <NoteEditor
          id="note-content"
          className={cn(
            'flex flex-1 flex-col p-4 pt-0 sm:m-4 sm:w-auto! sm:rounded-xl [&>div:has(.ProseMirror)]:flex-1',
            theme
              ? `dialog-${theme} shadow-xl shadow-theme-${theme}`
              : 'sm:shadow-sheet',
          )}
          editorClassName="h-full"
          menuClassNames={{
            fixedMenu: cn(
              'top-0 z-30 mb-4 gap-0 border-0 py-2 transition-[box-shadow,border-radius] duration-200 ease-out motion-reduce:transition-none',
              isToolbarDocked
                ? 'shadow-[0_8px_5px_-5px] shadow-ink/10 rounded-b-xl'
                : 'sm:rounded-t-xl',
            ),
          }}
          initialValue={mutateNoteData?.content || noteData?.content || ''}
          placeholder={emptyPlaceholders}
          commandTypes="always-fixed"
          compactToolbar
          toolbarLeading={
            <div
              className={cn(
                'shrink-0 overflow-hidden transition-all duration-200 ease-out motion-reduce:transition-none',
                isToolbarDocked
                  ? 'w-14 translate-x-0 opacity-100 sm:w-12'
                  : 'w-0 -translate-x-2 opacity-0',
              )}
              inert={!isToolbarDocked}
              aria-hidden={!isToolbarDocked}
            >
              <div className="flex w-max items-center gap-2">
                <Button
                  iconOnly
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 rounded-md focus-visible:-outline-offset-2 sm:h-8 sm:w-8"
                  onClick={handleSubmit}
                  disabled={isPending}
                  aria-label="Save and go back"
                >
                  <IconArrowLeft size="1.2rem" />
                </Button>
                <span
                  className="bg-hairline-strong h-5 w-px"
                  aria-hidden="true"
                />
              </div>
            </div>
          }
          toolbarTrailing={
            <div
              className={cn(
                'shrink-0 overflow-hidden transition-all duration-200 ease-out motion-reduce:transition-none max-sm:hidden',
                isToolbarDocked
                  ? 'w-8 translate-x-0 opacity-100'
                  : 'w-0 translate-x-2 opacity-0',
              )}
              inert={!isToolbarDocked}
              aria-hidden={!isToolbarDocked}
            >
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                className="shrink-0 focus-visible:-outline-offset-2 max-sm:hidden"
                onClick={() => void toggleFullscreen()}
                disabled={fullscreenErr}
                aria-label="Toggle fullscreen"
              >
                {isFullscreen ? (
                  <IconWindowMinimize size="1.2rem" />
                ) : (
                  <IconWindowMaximize size="1.2rem" />
                )}
              </Button>
            </div>
          }
          onChange={(value) => setMutateNoteData({content: value})}
          loading={isPending}
          exposeStorage
        />
      </div>

      <NoteCustomize
        type="update"
        details={
          <span className="group text-ink-muted cursor-default text-xs tabular-nums">
            <span className="opacity-0 transition-opacity group-hover:opacity-100 max-sm:hidden">
              {t('count.characters', {count: contentCount.characters})},{' '}
            </span>
            {t('count.words', {count: contentCount.words})}
          </span>
        }
        className={cn(
          scroll.y > 200 ? 'sm:pr-16' : '', // prevent overlap with scroll top button
          viewY < maxViewY - 16
            ? 'shadow-ink/10 shadow-[0_-8px_5px_-5px]'
            : 'dark:bg-paper-raised dark:backdrop-blur-none',
        )}
        loading={isPending}
        onDeleteSuccess={() => router.push('/eton')}
      />
    </main>
  )
}
