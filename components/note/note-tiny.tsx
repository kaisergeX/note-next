'use client'

import {IconDotsVertical, IconPalette, IconTrash} from '@tabler/icons-react'
import {cn} from 'cn'
import {useTranslations} from 'next-intl'
import {Link, useRouter} from '~/i18n/navigation'
import {isMobileNoteView} from '~/lib/notes/mobile'
import {useState, useTransition} from 'react'
import {moveNoteToTrashAction} from '~/app/[locale]/(note)/eton/actions'
import {buttonClass} from '~/components/ui/button'
import MenuCustom, {type MenuCustomItem} from '~/components/ui/menu'
import {performNoteMutation} from '~/lib/notes/client-mutation'
import {noteMutationSucceeded} from '~/lib/notes/lifecycle'
import type {Note} from '~/db/schema/notes'
import NoteCard, {NoteCardSummary} from './note-card'

type NoteProps = {
  data: Note
}

export default function NoteTiny({data}: NoteProps) {
  const {id: noteId, title, content, theme} = data
  const [pendingTransition, startTransition] = useTransition()
  const [deleteError, setDeleteError] = useState(false)
  const t = useTranslations('note')

  const router = useRouter()

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
      // The action returns the refreshed list. Keep this card mounted until
      // that commit removes its ViewTransition boundary and animates the gap.
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
      destructive: true,
      disabled: pendingTransition,
      onSelect: handleDeleteNote,
    },
  ]

  return (
    <NoteCard theme={theme}>
      <Link
        className="block h-full p-4 pb-10"
        href={`/eton/${noteId}`}
        onClick={(e) => {
          if (pendingTransition) {
            e.preventDefault()
            return
          }
          if (
            !e.defaultPrevented &&
            !e.metaKey &&
            !e.ctrlKey &&
            !e.shiftKey &&
            !e.altKey &&
            isMobileNoteView()
          ) {
            e.preventDefault()
            router.push(`/full/eton/${noteId}`)
          }
        }}
      >
        <NoteCardSummary title={title} content={content} theme={theme} />
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
    </NoteCard>
  )
}
