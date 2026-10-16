'use client'

import {cn} from 'cn'
import {
  IconArrowLeft,
  IconWindowMaximize,
  IconWindowMinimize,
} from '@tabler/icons-react'
import {useMessages, useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {useEffect, useLayoutEffect, useTransition} from 'react'
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

  return (
    <main className="relative flex flex-1 flex-col">
      <section className="bg-paper/70 border-hairline flex-center-between sticky inset-x-0 top-0 z-20 gap-4 border-b p-4 backdrop-blur-sm">
        <Button
          iconOnly
          onClick={handleSubmit}
          disabled={isPending}
          aria-label="Save and go back"
        >
          <IconArrowLeft />
        </Button>

        <div className="flex items-center gap-4">
          {contentCount.words > 1 && (
            <div className="group cursor-default text-xs sm:text-sm">
              <span className="opacity-0 transition-opacity group-hover:opacity-100 max-sm:hidden">
                {t('count.characters', {count: contentCount.characters})},
              </span>
              &nbsp;{t('count.words', {count: contentCount.words})}
            </div>
          )}
          <Button
            variant="secondary"
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

      <NoteEditor
        id="note-title"
        className="my-4 px-4"
        editorClassName="text-lg font-semibold sm:text-xl"
        initialValue={mutateNoteData?.title || noteData?.title || ''}
        onChange={(value) => setMutateNoteData({title: value})}
        placeholder="Title"
        limitCharacter={NOTE_TITLE_MAX_LENGTH}
        showCount
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
            'transition-shadow mb-4',
            scroll.y < 240
              ? ''
              : 'shadow-[0_8px_5px_-5px] shadow-ink/10 rounded-b-xl',
          ),
        }}
        initialValue={mutateNoteData?.content || noteData?.content || ''}
        placeholder={emptyPlaceholders}
        commandTypes="always-fixed"
        onChange={(value) => setMutateNoteData({content: value})}
        loading={isPending}
        exposeStorage
      />

      <NoteCustomize
        type="update"
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
