'use client'
import {classNames} from '@kaiverse/k/utils'
import {IconDotsVertical, IconPalette} from '@tabler/icons-react'
import Link from 'next/link'
import type {Note} from '~/db/schema/notes'
import {usePersistStore} from '~/store'

type NoteProps = {
  data: Note
}

export default function NoteTiny({data}: NoteProps) {
  const {id, title, content, theme} = data
  const setMutateNoteData = usePersistStore((state) => state.setMutateNoteData)

  return (
    <Link
      href={`/eton/${id}`}
      className={classNames(
        'card group relative p-4 pb-8',
        theme ? `dialog-${theme} shadow-theme-${theme} border-none` : '',
      )}
      onClick={() => {
        theme && setMutateNoteData({theme})
      }}
      // @todo Add a option on setting page for user to choose whether to use Dialog or not.
      // @todo Find a better option such as conditional render for this parallel route instead of open in new tab.
      // target='_blank' // if user prefers not to use Dialog to view/edit note.
    >
      {title && (
        <article
          className={classNames(
            'prose sm:prose-lg mb-4 line-clamp-3 font-semibold wrap-anywhere sm:leading-normal',
            theme ? `prose-${theme}` : 'dark:prose-invert',
          )}
          dangerouslySetInnerHTML={{__html: title || ''}}
        />
      )}
      <article
        className={classNames(
          'prose line-clamp-10 wrap-anywhere',
          theme ? `prose-${theme}` : 'dark:prose-invert',
        )}
        dangerouslySetInnerHTML={{__html: content || ''}}
      />

      <div
        className="absolute inset-x-0 bottom-0 hidden w-full cursor-default justify-between p-2 text-zinc-500 transition sm:group-focus-within:flex sm:group-hover:flex"
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
