import {classNames} from '@kaiverse/k/utils'
import {IconPalette, IconPaletteOff} from '@tabler/icons-react'
import {Fragment} from 'react'
import {twNoteThemeConfig} from '~/config/tailwindTheme'
import PopoverBase from '~/components/ui/popover'
import {usePersistStore} from '~/store'

export const NoteThemePicker = ({
  disabled = false,
}: {disabled?: boolean} = {}) => {
  const {theme, setMutateNoteData} = usePersistStore((s) => ({
    theme: s.mutateNoteData?.theme,
    setMutateNoteData: s.setMutateNoteData,
  }))

  const menuColors = [
    {
      id: 'default',
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
    ...twNoteThemeConfig.map(({theme: themeName}) => ({
      id: themeName,
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
    })),
  ]

  // closeOnSelect={false}: the popover stays open so theme changes preview
  // live; it closes on light-dismiss (outside click / Esc).
  return (
    <PopoverBase
      trigger={<IconPalette size="1.2rem" />}
      triggerClassName={classNames(
        'button-secondary rounded-full p-1',
        theme ? `border-theme-${theme}` : '',
      )}
      disabled={disabled}
      anchor="top-start"
      closeOnSelect={false}
      popoverClassName={classNames(
        `shadow-md shadow-theme-${theme || 'slate'}`,
        'grid-cols-4 gap-3 rounded-md p-3 open:grid',
      )}
    >
      {menuColors.map(({component, id}) => (
        <Fragment key={`theme-${id}`}>{component}</Fragment>
      ))}
    </PopoverBase>
  )
}
