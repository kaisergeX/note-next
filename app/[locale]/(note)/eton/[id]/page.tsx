'use client'
import {IconArrowLeft, IconPencil, IconTrash} from '@tabler/icons-react'
import {useRouter} from 'next/navigation'
import {fetcher} from '~/util'
import useSWR from 'swr'
import type {Note} from '~/db/schema/notes'

type NoteDetailProps = {params: {id: string}}

export default function NoteDetail({params: {id}}: NoteDetailProps) {
  const router = useRouter()
  const {data: noteData, error} = useSWR<Note, Error>(
    `/eton/actions?id=${id}`,
    fetcher,
  )

  if (error) {
    throw error
  }

  if (!noteData) {
    return <></>
  }

  const {title, content} = noteData

  return (
    <main className="relative flex h-full flex-col overflow-y-auto">
      <div className="glass sticky inset-x-0 top-0 flex items-center justify-between gap-4 p-4">
        <button
          type="button"
          className="button button-icon rounded-full p-1"
          onClick={() => router.push('/eton')}
        >
          <IconArrowLeft />
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            className="button-secondary button-icon rounded-full p-1"
            disabled
          >
            <IconPencil />
          </button>
          <button
            type="button"
            className="button-secondary button-icon rounded-full p-1"
            disabled
          >
            <IconTrash />
          </button>
        </div>
      </div>
      {title && <h1 className="px-8 py-6">{title}</h1>}

      <div className="shadow-theme m-4 flex-1 rounded-xl p-4">
        {content ? (
          <article
            className="prose prose-sm max-w-none dark:prose-invert sm:prose-base"
            dangerouslySetInnerHTML={{__html: content}}
          />
        ) : (
          <p className="cursor-default text-zinc-400">No content</p>
        )}
      </div>
    </main>
  )
}
