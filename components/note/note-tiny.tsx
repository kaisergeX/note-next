'use client'

import {IconDotsVertical, IconPalette, IconTrash} from '@tabler/icons-react'
import {cn} from 'cn'
import {useTranslations} from 'next-intl'
import {Link, useRouter} from '~/i18n/navigation'
import {useState, useTransition} from 'react'
import {moveNoteToTrashAction} from '~/app/[locale]/(note)/eton/actions'
import {buttonClass} from '~/components/ui/button'
import MenuCustom, {type MenuCustomItem} from '~/components/ui/menu'
import {performNoteMutation} from '~/lib/notes/client-mutation'
import {noteMutationSucceeded} from '~/lib/notes/lifecycle'
import type {Note} from '~/db/schema/notes'
import {usePersistStore} from '~/store'

type NoteProps = {
  data: Note
}

export default function NoteTiny({data}: NoteProps) {
  const router = useRouter()
  const [removed, setRemoved] = useState(false)
  const {id: noteId, title, content, theme} = data
  const [pendingTransition, startTransition] = useTransition()
  const [deleteError, setDeleteError] = useState(false)
  const setMutateNoteData = usePersistStore((state) => state.setMutateNoteData)
  const t = useTranslations('note')

  const isPreferFullView = false // @todo get from user settings

  const handleDeleteNote = () => {
    if (!noteId) {
      return
    }

    startTransition(async () => {
      setDeleteError(false)
      const result = await performNoteMutation(() =>
        moveNoteToTrashAction(noteId),
      )
      if (!noteMutationSucceeded(result)) {
        setDeleteError(true)
        return
      }
      setRemoved(true)
      router.refresh()
    })
  }

  const menuItems: MenuCustomItem[] = [
    {
      type: 'action',
      label: (
        <>
          <IconTrash size="1rem" /> {t('trash.move')}
        </>
      ),
      destructive: false,
      disabled: pendingTransition,
      onSelect: handleDeleteNote,
    },
  ]

  if (removed) return null

  return (
    <div
      className={cn(
        'group relative rounded-lg',
        'transition-shadow',
        theme
          ? `dialog-${theme} shadow-theme-${theme}`
          : 'bg-paper-raised border-hairline hover:shadow-sheet focus-within:shadow-sheet border',
      )}
    >
      <Link
        className="block h-full p-4 pb-10"
        href={`${isPreferFullView ? '/full' : ''}/eton/${noteId}`}
        onClick={(e) => {
          pendingTransition && e.preventDefault()
          theme && setMutateNoteData({theme})
        }}
      >
        {title && (
          <article
            className={cn(
              'prose sm:prose-lg line-clamp-3 font-semibold wrap-anywhere sm:leading-normal',
              theme ? `prose-${theme}` : 'prose-appearance',
            )}
            dangerouslySetInnerHTML={{__html: title || ''}}
          />
        )}
        <article
          className={cn(
            'prose line-clamp-10 pt-3 wrap-anywhere',
            theme ? `prose-${theme}` : 'prose-appearance',
          )}
          dangerouslySetInnerHTML={{__html: content || ''}}
        />
      </Link>

      {deleteError && (
        <p role="alert" className="text-destructive px-4 pb-10">
          {t('trash.moveFailed')}
        </p>
      )}
      <div
        className={cn(
          'text-ink-muted absolute inset-x-0 bottom-0 w-full cursor-default justify-between p-2 transition',
          'hidden group-has-[.note-tiny-menu:popover-open]:flex focus-within:flex hover:flex sm:group-focus-within:flex sm:group-hover:flex',
        )}
      >
        <span className="p-2" aria-hidden="true">
          <IconPalette size="1rem" />
        </span>

        <MenuCustom
          ariaLabel={t('accessibility.moreActions')}
          className={buttonClass({
            variant: 'ghost',
            size: 'sm',
            iconOnly: true,
          })}
          anchor="top-end"
          itemsClassName={cn(
            'note-tiny-menu',
            'rounded-lg bg-paper-raised border-hairline border',
            `shadow-none shadow-theme-${theme || 'slate'}`,
          )}
          items={menuItems}
        >
          <IconDotsVertical size="1rem" />
        </MenuCustom>
      </div>
    </div>
  )
}
