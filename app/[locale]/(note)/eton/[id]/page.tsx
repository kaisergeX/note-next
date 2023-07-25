'use client'
import {
  IconArrowLeft,
  IconCheck,
  IconLoader2,
  IconTrash,
} from '@tabler/icons-react'
import {useRouter} from 'next/navigation'
import {classNames, fetcher, genRandom, sleep} from '~/util'
import useSWR from 'swr'
import {NotesTable, type Note, type UpdateNote} from '~/db/schema/notes'
import type {ServerError} from '~/types'
import NoteEditor from '~/components/note/note-editor'
import {useWindowScroll} from '~/util/hooks/use-window-scroll'
import {useTransition} from 'react'
import {mutateNote} from '../actions'

type NoteDetailProps = {params: {id: string}}

export default function NoteDetail({params: {id}}: NoteDetailProps) {
  const router = useRouter()
  const [scroll, _, {viewY, maxViewY}] = useWindowScroll()
  const [isPending, startTransition] = useTransition()

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
  const newNoteData: UpdateNote = {...initNoteData}

  const handleSubmit = () => {
    if (JSON.stringify(initNoteData) === JSON.stringify(newNoteData)) {
      router.push('/eton')
      return
    }

    startTransition(async function () {
      await mutateNote(id, newNoteData)
      await sleep(200)
      router.push('/eton')
    })
  }

  return (
    <main className="relative flex flex-1 flex-col">
      <div className="bg-default flex-center-between sticky inset-x-0 top-0 z-10 gap-4 p-4">
        <button
          type="button"
          className="button button-icon rounded-full p-1"
          onClick={handleSubmit}
        >
          <IconArrowLeft />
        </button>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="button-secondary button-icon rounded-full p-1"
            disabled
          >
            <IconTrash />
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
        placeholder={isLoading ? 'Syncing...' : 'Title'}
        limitCharacter={NotesTable.title.length}
        showCount
        disableEnter
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
        />
      )}

      <div
        className={classNames(
          'bg-default flex-center-between sticky inset-x-0 bottom-0 w-full gap-4 p-4 transition-all',
          scroll.y > 200 ? 'sm:pr-16' : '', // prevent overlap with scroll top button
          viewY < maxViewY - 16
            ? 'shadow-[0_-8px_5px_-5px] shadow-zinc-600/10 dark:shadow-zinc-400/10'
            : '',
        )}
      >
        <div>Note customize menu</div>
        <div className="flex items-center gap-1 text-xs font-medium">
          {isPending || isLoading ? (
            <>
              <IconLoader2 className="animate-spin" size="1.2rem" /> Syncing
            </>
          ) : (
            <>
              <IconCheck className="text-green-600" size="1.2rem" /> Synced
            </>
          )}
        </div>
      </div>
    </main>
  )
}
