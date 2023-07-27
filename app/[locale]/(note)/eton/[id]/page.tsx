'use client'

import {
  IconArrowLeft,
  IconWindowMaximize,
  IconWindowMinimize,
} from '@tabler/icons-react'
import {useRouter} from 'next/navigation'
import {classNames, fetcher, genRandom} from '~/util'
import useSWR from 'swr'
import {
  type Note,
  type UpdateNote,
  NOTE_TITLE_MAX_LENGTH,
} from '~/db/schema/notes'
import type {ServerError} from '~/types'
import NoteEditor from '~/components/note/note-editor'
import {useWindowScroll} from '~/util/hooks/use-window-scroll'
import {useTransition} from 'react'
import {mutateNoteAction} from '../actions'
import NoteCustomize from '~/components/note/note-customize'
import {useFullscreen} from '~/util/hooks/use-fullscreen'
import {usePersistStore} from '~/store'

type NoteDetailProps = {params: {id: string}}

export default function NoteDetail({params: {id}}: NoteDetailProps) {
  const router = useRouter()
  const [scroll, _, {viewY, maxViewY}] = useWindowScroll()
  const [isPending, startTransition] = useTransition()
  const {isFullscreen, toggleFullscreen, error: fullscreenErr} = useFullscreen()
  const editorCharCount = usePersistStore((state) => state.editorCharCount)
  const contentCount = {
    words: editorCharCount['note-content']?.words || 0,
    characters: editorCharCount['note-content']?.characters || 0,
  }

  const {
    data: noteData,
    isLoading,
    error,
  } = useSWR<Note, ServerError>(`/api/note/${id}`, fetcher)

  if (error) {
    throw error
  }

  const initNoteData: UpdateNote = {
    title: noteData?.title || '',
    content: noteData?.content || '',
  }
  const newNoteData: UpdateNote = structuredClone(initNoteData)

  const handleSubmit = () => {
    if (JSON.stringify(initNoteData) === JSON.stringify(newNoteData)) {
      router.push('/eton')
      return
    }

    startTransition(async function () {
      await mutateNoteAction(id, newNoteData)
      router.push('/eton')
    })
  }

  return (
    <main className="relative flex flex-1 flex-col">
      <div className="bg-default flex-center-between sticky inset-x-0 top-0 z-20 gap-4 p-4">
        <button
          type="button"
          className="button button-icon rounded-full p-1"
          onClick={handleSubmit}
        >
          <IconArrowLeft />
        </button>

        <div className="flex items-center gap-4">
          {contentCount.words > 1 && (
            <div className="group cursor-default text-xs sm:text-sm">
              <span className="opacity-0 transition-opacity group-hover:opacity-100 sm-only:hidden">
                {contentCount.characters} characters,
              </span>
              &nbsp;{contentCount.words} words
            </div>
          )}
          <button
            type="button"
            title="Toggle fullscreen"
            className="button-secondary button-icon rounded-full p-1 sm-only:hidden"
            onClick={() => void toggleFullscreen()}
            disabled={fullscreenErr}
          >
            {isFullscreen ? <IconWindowMinimize /> : <IconWindowMaximize />}
          </button>
        </div>
      </div>

      <NoteEditor
        id="note-title"
        className="my-4 px-4"
        editorClassName="text-lg font-semibold sm:text-xl"
        initialValue={noteData?.title}
        onChange={(value) => {
          newNoteData.title = value
        }}
        placeholder="Title"
        limitCharacter={NOTE_TITLE_MAX_LENGTH}
        showCount
        disableEnter
        autofocus="end"
        loading={isPending || isLoading}
      />

      {isLoading ? (
        <div className="flex-center mx-4 h-full animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      ) : (
        <NoteEditor
          id="note-content"
          className="sm:shadow-theme flex flex-1 flex-col p-4 pt-0 sm:m-4 sm:!w-auto sm:rounded-xl [&>div:has(.ProseMirror)]:flex-1"
          editorClassName="h-full"
          menuClassNames={{
            fixedMenu: classNames(
              'transition-shadow',
              scroll.y < 240
                ? ''
                : 'shadow-[0_8px_5px_-5px] shadow-zinc-600/10 dark:shadow-zinc-400/10',
            ),
          }}
          initialValue={noteData?.content}
          placeholder={genRandom([
            'Nothing here yet 😶‍🌫️',
            'New💡',
            "Let's add something inspirational ✨",
            'Tasks to do 📝',
          ])}
          commandTypes="always-fixed"
          onChange={(value) => {
            newNoteData.content = value
          }}
          loading={isPending}
          exposeStorage
        />
      )}

      <NoteCustomize
        note={noteData}
        mutatedNote={newNoteData}
        type="update"
        className={classNames(
          scroll.y > 200 ? 'sm:pr-16' : '', // prevent overlap with scroll top button
          viewY < maxViewY - 16
            ? 'shadow-[0_-8px_5px_-5px] shadow-zinc-600/10 dark:shadow-zinc-400/10'
            : '',
        )}
        loading={isPending}
        onDeleteSuccess={() => router.push('/eton')}
      />
    </main>
  )
}
