'use client'

import {classNames} from '@kaiverse/k/utils'
import {
  IconCheck,
  IconDotsVertical,
  IconLoader2,
  IconPalette,
  IconPaletteOff,
  IconTexture,
  IconTrash,
} from '@tabler/icons-react'
import {useTransition} from 'react'
import {deleteNoteAction} from '~/app/[locale]/(note)/eton/actions'
import {twNoteThemeConfig} from '~/config/tailwindTheme'
import {usePersistStore} from '~/store'
import MenuCustom, {type MenuItem} from '../ui/menu'

export type NoteCustomizeProps = {
  className?: string
  loading?: boolean
  type: 'update' | 'create'
  onDeleteSuccess?: () => void
}

export default function NoteCustomize({
  className = '',
  loading,
  type,
  onDeleteSuccess,
}: NoteCustomizeProps) {
  const [pendingTransition, startTransition] = useTransition()
  const {noteId, theme, setMutateNoteData} = usePersistStore((s) => ({
    noteId: s.mutateNoteData?.id,
    theme: s.mutateNoteData?.theme,
    setMutateNoteData: s.setMutateNoteData,
  }))

  const handleDeleteNote = () => {
    if (!noteId) {
      return
    }

    startTransition(async () => {
      await deleteNoteAction(noteId)
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
          disabled={loading || pendingTransition}
        >
          <IconTrash size="1.2rem" /> Delete note
        </button>
      ),
      hidden: type !== 'update' || !noteId,
    },
  ]

  const customMenuColors: MenuItem[] = twNoteThemeConfig.map(
    ({theme: themeName}) => ({
      component: (
        <button
          className={classNames(
            'block h-8 w-8 rounded-full transition-shadow',
            `picker-${themeName}`,
            theme && theme === themeName
              ? 'ring-2 ring-offset-2'
              : 'ring-offset-1 hover:ring-2',
          )}
          title={themeName}
          type="button"
          onClick={() => setMutateNoteData({theme: themeName})}
          disabled={theme === themeName}
        />
      ),
    }),
  )

  const menuColors: MenuItem[] = [
    {
      component: (
        <button
          className="button-secondary button-icon rounded-full p-1"
          title="Default"
          type="button"
          onClick={() => setMutateNoteData({theme: null})}
          disabled={!theme}
        >
          <IconPaletteOff />
        </button>
      ),
    },
    ...customMenuColors,
  ]

  return (
    <div
      className={classNames(
        'flex-center-between sticky inset-x-0 bottom-0 w-full gap-4 p-4 transition-all',
        theme ? 'glass bg-inherit backdrop-blur-md' : 'bg-default',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <MenuCustom
          items={menuColors}
          className="button-icon rounded-full p-1"
          itemsClassName="w-48 grid grid-cols-4 gap-2 p-4 [--anchor-gap:0.5rem]"
          anchor="bottom start"
        >
          <IconPalette size="1.2rem" />
        </MenuCustom>

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
            itemsClassName="w-48 [--anchor-gap:0.5rem]"
          >
            <IconDotsVertical size="1.2rem" />
          </MenuCustom>
        )}
      </div>
    </div>
  )
}
