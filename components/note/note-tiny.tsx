'use client'
import {IconDotsVertical, IconPalette} from '@tabler/icons-react'
import Link from 'next/link'
import type {Note} from '~/db/schema/notes'

type NoteProps = {
  data: Note
}

export default function NoteTiny({data}: NoteProps) {
  const {id, title, content} = data

  return (
    <Link
      href={`/eton/${id}`}
      className="card group relative max-h-96 p-4 pb-8 "
      // @todo Add a option on setting page for user to choose whether to use Dialog or not.
      // @todo Find a better option such as conditional render for this parallel route instead of open in new tab.
      // target='_blank' // if user prefers not to use Dialog to view/edit note.
    >
      {title && (
        <article
          className="prose mb-4 line-clamp-3 font-semibold dark:prose-invert sm:prose-lg sm:leading-normal"
          dangerouslySetInnerHTML={{__html: title || ''}}
        />
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
