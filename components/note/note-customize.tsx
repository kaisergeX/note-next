'use client'

import {classNames} from '@kaiverse/k/utils'
import {
  IconArrowUp,
  IconCheck,
  IconDotsVertical,
  IconLoader2,
  IconPalette,
  IconPaletteOff,
  IconTexture,
  IconTrash,
} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type RefObject,
} from 'react'
import {deleteNoteAction} from '~/app/[locale]/(note)/eton/actions'
import {twNoteThemeConfig} from '~/config/tailwindTheme'
import {usePersistStore} from '~/store'

export type NoteCustomizeProps = {
  className?: string
  loading?: boolean
  type: 'update' | 'create'
  onDeleteSuccess?: () => void
  scrollContainerRef?: RefObject<HTMLElement | null>
  scrollTopCtrl?: boolean
}

function isScrollableY(el?: HTMLElement | null) {
  if (!el) return false

  // if (el.scrollHeight !== el.clientHeight)
  return el.scrollHeight > el.clientHeight

  // as a last resort: try to scroll it programmatically
  // const prevScrollTop = el.scrollTop
  // el.scrollTop += 1
  // const scrolled = el.scrollTop !== prevScrollTop
  // el.scrollTop = prevScrollTop // restore
  // return scrolled
}

export default function NoteCustomize({
  className = '',
  loading,
  type,
  onDeleteSuccess,
  scrollContainerRef,
  scrollTopCtrl = false,
}: NoteCustomizeProps) {
  const [pendingTransition, startTransition] = useTransition()
  const {noteId, theme, setMutateNoteData} = usePersistStore((s) => ({
    noteId: s.mutateNoteData?.id,
    theme: s.mutateNoteData?.theme,
    setMutateNoteData: s.setMutateNoteData,
  }))
  const t = useTranslations('note')
  const ref = useRef<HTMLDivElement>(null)
  const [scrollable, setScrollable] = useState(false)
  const prefixId = `note-dialog-${type}-${noteId || 'new'}`
  const isLoading = loading || pendingTransition

  const getScrollContainer = () =>
    scrollContainerRef?.current
      ? scrollContainerRef.current
      : ref.current?.parentElement

  useLayoutEffect(() => {
    const container = getScrollContainer()
    if (!scrollTopCtrl || !container) return

    const checkScrollable = () => setScrollable(isScrollableY(container))
    checkScrollable()

    // observe container size changes
    const resizeObserver = new ResizeObserver(checkScrollable)
    resizeObserver.observe(container)

    // also observe content size changes
    // const mutationObserver = new MutationObserver(checkScrollable)
    // mutationObserver.observe(container, {childList: true, subtree: true})

    return () => {
      resizeObserver.disconnect()
      // mutationObserver.disconnect()
    }
  }, [scrollTopCtrl])

  const handleDeleteNote = () => {
    if (!noteId) {
      return
    }

    startTransition(async () => {
      await deleteNoteAction(noteId)
      onDeleteSuccess?.()
    })
  }

  const menuItems = [
    {
      id: 'delete',
      component: (
        <button
          className="button-secondary text-danger w-full rounded-none border-none shadow-none"
          type="button"
          onClick={handleDeleteNote}
          disabled={isLoading}
        >
          <IconTrash size="1.2rem" /> {t('delete')}
        </button>
      ),
      hidden: type !== 'update' || !noteId,
    },
  ]

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
      ref={ref}
      className={classNames(
        'flex-center-between sticky inset-x-0 bottom-0 w-full gap-4 p-4 transition-all max-md:pb-[calc(1rem+env(safe-area-inset-bottom))]',
        theme ? 'glass bg-inherit backdrop-blur-md' : 'bg-default',
        scrollTopCtrl && scrollable
          ? 'animate-scroll animate-[pr] [--pr-to:4rem] [animation-range-end:5rem]'
          : '',
        className,
      )}
    >
      <div
        className="flex items-center gap-2"
        style={
          {
            '--theme-anchor-name': `--${prefixId}-theme-anchor`,
          } as CSSProperties
        }
      >
        <button
          className="button-secondary button-icon rounded-full p-1 [anchor-name:var(--theme-anchor-name)]"
          type="button"
          popoverTarget={`${prefixId}-theme`}
          popoverTargetAction="toggle"
          disabled={isLoading}
        >
          <IconPalette size="1.2rem" />
        </button>
        <div
          id={`${prefixId}-theme`}
          className={classNames(
            `shadow-md shadow-theme-${theme}`,
            'grid-cols-4 gap-3 rounded-md p-3 open:grid',
            'position-try-y-[top_span-right] position-anchor-[var(--theme-anchor-name)] absolute inset-auto mb-2',
          )}
          popover="auto"
        >
          {menuColors.map(({component, id}) => (
            <Fragment key={`theme-${id}`}>{component}</Fragment>
          ))}
        </div>

        <button
          className="button-secondary button-icon rounded-full p-1"
          title="Illustration, Texture"
          type="button"
          disabled
        >
          <IconTexture size="1.2rem" />
        </button>
      </div>

      <div
        className="flex items-center gap-2"
        style={{'--anchor-name': `--${prefixId}-anchor`} as CSSProperties}
      >
        {type === 'update' && (
          <div className="flex items-center gap-1 text-xs font-medium">
            {isLoading ? (
              <>
                <IconLoader2 className="animate-spin" size="1.2rem" />{' '}
                {t('status.syncing')}
              </>
            ) : (
              <>
                <IconCheck className="text-green-600" size="1.2rem" />{' '}
                {t('status.synced')}
              </>
            )}
          </div>
        )}

        {!pendingTransition && menuItems.every(({hidden}) => !hidden) && (
          <>
            <button
              className="[anchor-name:var(--anchor-name)]"
              type="button"
              popoverTarget={`${prefixId}-menu`}
              popoverTargetAction="toggle"
              disabled={isLoading}
            >
              <IconDotsVertical size="1.2rem" />
            </button>
            <div
              id={`${prefixId}-menu`}
              className={classNames(
                `shadow-md shadow-theme-${theme}`,
                'rounded-md',
                'position-try-y-[top_span-left] position-anchor-[var(--anchor-name)] absolute inset-auto mb-2',
              )}
              popover="auto"
            >
              {menuItems.map(({component, id}) => (
                <Fragment key={id}>{component}</Fragment>
              ))}
            </div>
          </>
        )}
      </div>

      {scrollTopCtrl && scrollable && (
        <button
          type="button"
          className={classNames(
            'button button-icon absolute right-4 bottom-4 rounded-full p-1 transition-all will-change-transform',
            'animate-affix-appear [--affix-y-from:2] [animation-range-end:6rem] [animation-range-start:2rem]',
          )}
          onClick={() =>
            getScrollContainer()?.scrollTo({top: 0, behavior: 'smooth'})
          }
        >
          <IconArrowUp />
        </button>
      )}
    </div>
  )
}
