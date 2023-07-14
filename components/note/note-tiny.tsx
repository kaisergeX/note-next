'use client'
import {IconDotsVertical, IconPalette} from '@tabler/icons-react'
import Link from 'next/link'
import type {NoteData} from '~/types/note'

type NoteProps = {
  data: NoteData
}

export default function NoteTiny({data}: NoteProps) {
  const {id, title, content} = data

  return (
    <Link
      href={`/eton/${id}`}
      className="group relative max-h-96 rounded-lg border border-solid border-zinc-200 p-4 pb-8 
        transition-shadow duration-150 ease-in-out hover:shadow-md dark:border-zinc-700 dark:bg-zinc-800"
    >
      {title && (
        <div className="mb-4 line-clamp-3 font-semibold tracking-tight text-gray-900 dark:text-white">
          {title}
        </div>
      )}
      <article
        className="prose line-clamp-[10] dark:prose-invert"
        dangerouslySetInnerHTML={{__html: content || ''}}
      />

      <div
        className="absolute inset-x-0 bottom-0 hidden w-full cursor-default justify-between p-2 text-zinc-500 transition 
          sm:group-focus-within:flex sm:group-hover:flex"
        onClick={(e) => e.preventDefault()}
      >
        <button type="button">
          <IconPalette size="1rem" />
        </button>
        <button type="button">
          <IconDotsVertical size="1rem" />
        </button>
      </div>
    </Link>
  )
}
