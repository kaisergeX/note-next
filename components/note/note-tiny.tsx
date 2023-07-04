'use client'
import {IconDotsVertical, IconPalette} from '@tabler/icons-react'
import type {NoteData} from '~/types/note'

type NoteProps = {
  data: NoteData
}

export default function NoteTiny({data}: NoteProps) {
  const {title, content} = data

  const handleOpenNote = () => {
    console.log(data)
  }

  return (
    <div
      className="group relative max-h-96 rounded-lg border border-solid border-zinc-200 p-4 pb-6 
        transition-shadow duration-150 ease-in-out hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800"
      onClick={handleOpenNote}
    >
      {title && (
        <div className="mb-4 line-clamp-3 cursor-default font-semibold tracking-tight text-gray-900 dark:text-white">
          {title}
        </div>
      )}
      <article
        className="prose line-clamp-[10] cursor-default"
        dangerouslySetInnerHTML={{__html: content || ''}}
      />

      <div
        className="absolute inset-x-0 bottom-0 hidden w-full justify-between p-2 text-zinc-500 transition group-focus-within:flex group-hover:flex"
        onClick={(e) => e.stopPropagation()}
      >
        <IconPalette size="1rem" /> <IconDotsVertical size="1rem" />
      </div>
    </div>
  )
}
