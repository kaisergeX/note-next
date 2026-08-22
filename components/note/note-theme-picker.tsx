import {classNames} from '@kaiverse/k/utils'
import {IconPalette, IconPaletteOff} from '@tabler/icons-react'
import {Fragment, type CSSProperties} from 'react'
import {twNoteThemeConfig} from '~/config/tailwindTheme'
import {usePersistStore} from '~/store'

export const NoteThemePicker = ({
  prefixId: pId,
  disabled = false,
}: {prefixId?: string; disabled?: boolean} = {}) => {
  const {noteId, theme, setMutateNoteData} = usePersistStore((s) => ({
    noteId: s.mutateNoteData?.id,
    theme: s.mutateNoteData?.theme,
    setMutateNoteData: s.setMutateNoteData,
  }))

  const prefixId = `note-${pId}-${noteId || 'new'}`

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

  return (
    <div
      className="contents"
      style={
        {
          '--theme-anchor-name': `--${prefixId}-theme-anchor`,
        } as CSSProperties
      }
    >
      <button
        className={`button-secondary rounded-full p-1 [anchor-name:var(--theme-anchor-name)] border-theme-${theme}`}
        type="button"
        popoverTarget={`${prefixId}-theme`}
        popoverTargetAction="toggle"
        disabled={disabled}
      >
        <IconPalette size="1.2rem" />
      </button>

      <div
        id={`${prefixId}-theme`}
        className={classNames(
          `shadow-md shadow-theme-${theme}`,
          'grid-cols-4 gap-3 rounded-md p-3 open:grid',
          'position-try-y-[top_span-right] position-anchor-(--theme-anchor-name) absolute inset-auto mb-2',
        )}
        popover="auto"
      >
        {menuColors.map(({component, id}) => (
          <Fragment key={`theme-${id}`}>{component}</Fragment>
        ))}
      </div>
    </div>
  )
}
