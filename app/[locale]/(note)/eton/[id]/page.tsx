'use client'

import {classNames} from '@kaiverse/k/utils'
import {
  IconArrowLeft,
  IconWindowMaximize,
  IconWindowMinimize,
} from '@tabler/icons-react'
import {useRouter} from 'next/navigation'
import {use, useTransition} from 'react'
import useSWR from 'swr'
import NoteCustomize from '~/components/note/note-customize'
import NoteEditor from '~/components/note/note-editor'
import {
  type Note,
  type UpdateNote,
  NOTE_TITLE_MAX_LENGTH,
} from '~/db/schema/notes'
import {usePersistStore} from '~/store'
import type {PropsWithLocale, ServerError} from '~/types'
import {fetcher, genRandom, isEqualNonNestedObj} from '~/util'
import {useFullscreen} from '~/util/hooks/use-fullscreen'
import {useWindowScroll} from '~/util/hooks/use-window-scroll'
import {mutateNoteAction} from '../actions'

type NoteDetailProps = PropsWithLocale<unknown, {id: string}>

export default function NoteDetail(props: NoteDetailProps) {
  const id = use(props.params).id
  const router = useRouter()
  const [scroll, _, {viewY, maxViewY}] = useWindowScroll()
  const [isPending, startTransition] = useTransition()
  const {isFullscreen, toggleFullscreen, error: fullscreenErr} = useFullscreen()
  const {mutateNoteData, setMutateNoteData, editorCharCount} = usePersistStore()
  const theme = mutateNoteData?.theme

  const contentCount = {
    words: editorCharCount['note-content']?.words || 0,
    characters: editorCharCount['note-content']?.characters || 0,
  }

  const {
    data: noteData,
    isLoading,
    error,
  } = useSWR<Note, ServerError>(`/api/note/${id}`, fetcher, {
    onSuccess: (data) =>
      setMutateNoteData({
        title: data?.title || '',
        content: data?.content || '',
        theme: data?.theme,
      }),
  })

  if (error) {
    throw error
  }

  const initNoteData: UpdateNote = {
    title: noteData?.title || '',
    content: noteData?.content || '',
    theme: noteData?.theme,
  }

  const handleSubmit = () => {
    if (!mutateNoteData || isEqualNonNestedObj(initNoteData, mutateNoteData)) {
      setMutateNoteData(undefined)
      router.push('/eton')
      return
    }

    startTransition(async function () {
      await mutateNoteAction(id, mutateNoteData)
      setMutateNoteData(undefined)
      router.push('/eton')
    })
  }

  return (
    <main className="relative flex flex-1 flex-col">
      <section className="bg-default flex-center-between sticky inset-x-0 top-0 z-20 gap-4 p-4">
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
              <span className="opacity-0 transition-opacity group-hover:opacity-100 max-sm:hidden">
                {contentCount.characters} characters,
              </span>
              &nbsp;{contentCount.words} words
            </div>
          )}
          <button
            type="button"
            title="Toggle fullscreen"
            className="button-secondary button-icon rounded-full p-1 max-sm:hidden"
            onClick={() => void toggleFullscreen()}
            disabled={fullscreenErr}
          >
            {isFullscreen ? <IconWindowMinimize /> : <IconWindowMaximize />}
          </button>
        </div>
      </section>

      <NoteEditor
        id="note-title"
        className="my-4 px-4"
        editorClassName="text-lg font-semibold sm:text-xl"
        initialValue={mutateNoteData?.title}
        defaultTheme
        onChange={(value) => setMutateNoteData({title: value})}
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
          className={classNames(
            'flex flex-1 flex-col p-4 pt-0 sm:m-4 sm:w-auto! sm:rounded-xl [&>div:has(.ProseMirror)]:flex-1',
            theme
              ? `dialog-${theme} shadow-xl shadow-theme-${theme}`
              : 'sm:shadow-theme',
          )}
          editorClassName="h-full"
          menuClassNames={{
            fixedMenu: classNames(
              'transition-shadow mb-4',
              scroll.y < 240
                ? ''
                : 'shadow-[0_8px_5px_-5px] shadow-zinc-600/10 dark:shadow-zinc-400/10 rounded-b-xl',
            ),
          }}
          initialValue={mutateNoteData?.content}
          placeholder={genRandom([
            'Nothing here yet 😶‍🌫️',
            'New💡',
            "Let's add something inspirational ✨",
            'Tasks to do 📝',
          ])}
          commandTypes="always-fixed"
          onChange={(value) => setMutateNoteData({content: value})}
          loading={isPending}
          exposeStorage
        />
      )}

      <NoteCustomize
        note={noteData}
        type="update"
        className={classNames(
          scroll.y > 200 ? 'sm:pr-16' : '', // prevent overlap with scroll top button
          viewY < maxViewY - 16
            ? 'shadow-[0_-8px_5px_-5px] shadow-zinc-600/10 dark:shadow-zinc-400/10'
            : 'dark:bg-zinc-900 dark:backdrop-blur-none',
          theme && viewY < maxViewY - 16 ? 'dark:text-black' : '',
        )}
        loading={isPending}
        onDeleteSuccess={() => router.push('/eton')}
      />
    </main>
  )
}
