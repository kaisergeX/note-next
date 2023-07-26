'use client'

import {
  IconLoader2,
  IconCheck,
  IconDotsVertical,
  IconTrash,
  IconTexture,
} from '@tabler/icons-react'
import {classNames} from '~/util'
import MenuCustom, {type MenuItem} from '../ui/menu'
import {useTransition} from 'react'
import {deleteNoteAction} from '~/app/[locale]/(note)/eton/actions'
import type {Note, UpdateNote} from '~/db/schema/notes'
import {IconPalette} from '@tabler/icons-react'

export type NoteCustomizeProps = {
  note?: Note
  mutatedNote?: UpdateNote

  className?: string
  loading?: boolean
  type: 'update' | 'create'
  onDeleteSuccess?: () => void
}

export default function NoteCustomize({
  note,

  className = '',
  loading,
  type,
  onDeleteSuccess,
}: NoteCustomizeProps) {
  const [pendingTransition, startTransition] = useTransition()

  const handleDeleteNote = () => {
    if (!note) {
      return
    }

    startTransition(async () => {
      await deleteNoteAction(note.id)
      onDeleteSuccess?.()
    })
  }

  const menuItems: MenuItem[] = [
    {
      component: (
        <button
          className="button-secondary w-full text-red-500"
          type="button"
          onClick={handleDeleteNote}
        >
          <IconTrash size="1.2rem" /> Delete note
        </button>
      ),
      hidden: type !== 'update' || !note,
    },
  ]

  return (
    <div
      className={classNames(
        'bg-default flex-center-between sticky inset-x-0 bottom-0 w-full gap-4 p-4 transition-all',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <button
          className="button-icon rounded-full p-1"
          title="Background color"
          type="button"
          disabled
        >
          <IconPalette size="1.2rem" />
        </button>
        <button
          className="button-icon rounded-full p-1"
          title="Illustration, Texture"
          type="button"
          disabled
        >
          <IconTexture size="1.2rem" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        {type === 'update' && (
          <div className="flex items-center gap-1 text-xs font-medium">
            {loading || pendingTransition ? (
              <>
                <IconLoader2 className="animate-spin" size="1.2rem" /> Syncing
              </>
            ) : (
              <>
                <IconCheck className="text-green-600" size="1.2rem" /> Synced
              </>
            )}
          </div>
        )}

        {!pendingTransition && menuItems.every(({hidden}) => !hidden) && (
          <MenuCustom
            items={menuItems}
            className="block"
            itemsClassName="w-48"
            floatOptions={{
              portal: true,
              flip: true,
            }}
          >
            <IconDotsVertical size="1.2rem" />
          </MenuCustom>
        )}
      </div>
    </div>
  )
}
