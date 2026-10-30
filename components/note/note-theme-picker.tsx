import {cn} from 'cn'
import {IconPalette, IconPaletteOff} from '@tabler/icons-react'
import {Fragment} from 'react'
import {useTranslations} from 'next-intl'
import {twNoteThemeConfig} from '~/config/tailwindTheme'
import PopoverBase from '~/components/ui/popover'
import Button, {buttonClass, type ButtonSize} from '~/components/ui/button'
import {usePersistStore} from '~/store'

export const NoteThemePicker = ({
  disabled = false,
  size = 'sm',
}: {disabled?: boolean; size?: ButtonSize} = {}) => {
  const tAccessibility = useTranslations('note.accessibility')
  const {theme, setMutateNoteData} = usePersistStore((s) => ({
    theme: s.mutateNoteData?.theme,
    setMutateNoteData: s.setMutateNoteData,
  }))

  const menuColors = [
    {
      id: 'default',
      component: (
        <Button
          className="p-1"
          variant="secondary"
          iconOnly
          title="Default"
          aria-label="Default theme"
          onClick={() => setMutateNoteData({theme: null})}
          disabled={!theme}
        >
          <IconPaletteOff />
        </Button>
      ),
    },
    ...twNoteThemeConfig.map(({theme: themeName}) => ({
      id: themeName,
      component: (
        <button
          className={cn(
            'block size-10 rounded-full transition-shadow',
            `picker-${themeName}`,
            theme && theme === themeName
              ? 'ring-2 ring-offset-2'
              : 'ring-offset-1 hover:ring-2',
          )}
          title={themeName}
          aria-label={tAccessibility('selectTheme', {theme: themeName})}
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
      trigger={<IconPalette size="18" />}
      triggerAriaLabel={tAccessibility('chooseTheme')}
      triggerClassName={cn(
        buttonClass({variant: 'secondary', size, iconOnly: true}),
        theme ? `border-theme-${theme}` : '',
      )}
      disabled={disabled}
      anchor="top-start"
      closeOnSelect={false}
      className={cn(
        `shadow-md shadow-theme-${theme || 'slate'}`,
        'bg-paper-raised border-hairline border',
        'grid-cols-4 place-items-center gap-3 rounded-lg p-3 open:grid',
      )}
    >
      {menuColors.map(({component, id}) => (
        <Fragment key={`theme-${id}`}>{component}</Fragment>
      ))}
    </PopoverBase>
  )
}
