'use client'

import {classNames} from '@kaiverse/k/utils'
import {IconDotsVertical, IconPalette, IconTrash} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import {useTransition} from 'react'
import {deleteNoteAction} from '~/app/[locale]/(note)/eton/actions'
import type {Note} from '~/db/schema/notes'
import PopoverBase from '~/components/ui/popover'
import {usePersistStore} from '~/store'

type NoteProps = {
  data: Note
}

export default function NoteTiny({data}: NoteProps) {
  const {id: noteId, title, content, theme} = data
  const [pendingTransition, startTransition] = useTransition()
  const setMutateNoteData = usePersistStore((state) => state.setMutateNoteData)
  const t = useTranslations('note')

  const isPreferFullView = false // @todo get from user settings

  const handleDeleteNote = () => {
    if (!noteId) {
      return
    }

    startTransition(async () => {
      await deleteNoteAction(noteId)
    })
  }

  return (
    <div
      className={classNames(
        'card group relative',
        theme ? `dialog-${theme} shadow-theme-${theme} border-none` : '',
      )}
    >
      <Link
        className="block h-full p-4 pb-8"
        href={`${isPreferFullView ? '/full' : ''}/eton/${noteId}`}
        onClick={(e) => {
          pendingTransition && e.preventDefault()
          theme && setMutateNoteData({theme})
        }}
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
      </Link>

      <div
        className={classNames(
          'absolute inset-x-0 bottom-0 w-full cursor-default justify-between p-2 text-zinc-500 transition',
          'hidden group-has-[.note-tiny-menu:popover-open]:flex focus-within:flex hover:flex sm:group-focus-within:flex sm:group-hover:flex',
        )}
      >
        <button className="p-2" type="button">
          <IconPalette size="1rem" />
        </button>

        <PopoverBase
          trigger={<IconDotsVertical size="1rem" />}
          triggerClassName="p-2"
          anchor="top-end"
          popoverClassName={classNames(
            'note-tiny-menu',
            // restores the UA popover's default 0.25em padding for the
            // full-bleed delete button.
            'p-1',
            `shadow-md shadow-theme-${theme || 'slate'}`,
            'rounded-md',
          )}
        >
          <button
            className="button-secondary text-danger w-full rounded-none border-none shadow-none"
            type="button"
            onClick={handleDeleteNote}
            disabled={pendingTransition}
          >
            <IconTrash size="1rem" /> {t('delete')}
          </button>
        </PopoverBase>
      </div>
    </div>
  )
}
