'use client'

import {cn} from 'cn'
import {
  IconArrowUp,
  IconCheck,
  IconDotsVertical,
  IconLoader2,
  IconTexture,
  IconTrash,
} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from 'react'
import {usePersistStore} from '~/store'
import Button, {buttonClass} from '~/components/ui/button'
import MenuCustom, {type MenuCustomItem} from '~/components/ui/menu'
import {NoteThemePicker} from './note-theme-picker'

export type NoteCustomizeProps = {
  className?: string
  loading?: boolean
  error?: boolean
  type: 'update' | 'create'
  onMoveToTrash?: () => void
  scrollContainerRef?: RefObject<HTMLElement | null>
  scrollTopCtrl?: boolean
  details?: ReactNode
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
  error,
  type,
  onMoveToTrash,
  scrollContainerRef,
  scrollTopCtrl = false,
  details,
}: NoteCustomizeProps) {
  const {noteId, theme} = usePersistStore((s) => ({
    noteId: s.mutateNoteData?.id,
    theme: s.mutateNoteData?.theme,
  }))
  const t = useTranslations('note')
  const ref = useRef<HTMLDivElement>(null)
  const [scrollable, setScrollable] = useState(false)
  const isLoading = loading

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTopCtrl])

  const menuItems: MenuCustomItem[] = [
    {
      type: 'action',
      label: (
        <>
          <IconTrash size="1.2rem" /> {t('trash.move')}
        </>
      ),
      destructive: false,
      onSelect: () => onMoveToTrash?.(),
      disabled: isLoading || !onMoveToTrash,
      hidden: type !== 'update' || !noteId,
    },
  ]

  return (
    <div
      ref={ref}
      className={cn(
        'flex-center-between sticky inset-x-0 bottom-0 w-full gap-4 p-4 transition-all max-md:pb-[calc(1rem+env(safe-area-inset-bottom))]',
        'bg-paper/50 border-hairline border-t backdrop-blur-sm',
        scrollTopCtrl && scrollable
          ? 'animate-scroll animate-[pr] [--pr-to:4rem] [animation-range-end:5rem]'
          : '',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <NoteThemePicker disabled={isLoading} />

        <Button
          variant="secondary"
          size="sm"
          iconOnly
          className={theme ? `border-theme-${theme}` : ''}
          title="Illustration, Texture"
          disabled
        >
          <IconTexture size="18" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {details}
        {type === 'update' && (
          <div className="flex items-center gap-1 text-xs font-medium">
            {isLoading ? (
              <>
                <IconLoader2 className="animate-spin" size="1.2rem" />{' '}
                {t('status.syncing')}
              </>
            ) : error ? (
              <span className="text-destructive">{t('status.failed')}</span>
            ) : (
              <>
                <IconCheck
                  className="text-success saturate-150"
                  size="1.2rem"
                  strokeWidth={3}
                />{' '}
                {t('status.synced')}
              </>
            )}
          </div>
        )}

        {menuItems.every(({hidden}) => !hidden) && (
          <MenuCustom
            ariaLabel={t('accessibility.moreActions')}
            className={buttonClass({
              variant: 'ghost',
              size: 'sm',
              iconOnly: true,
            })}
            anchor="top-end"
            disabled={isLoading}
            itemsClassName={cn(
              'rounded-lg bg-paper-raised border border-hairline',
              `shadow-none shadow-theme-${theme || 'slate'}`,
            )}
            items={menuItems}
          >
            <IconDotsVertical size="1.2rem" />
          </MenuCustom>
        )}
      </div>

      {scrollTopCtrl && scrollable && (
        <Button
          variant="secondary"
          iconOnly
          aria-label="Scroll to top"
          className={cn(
            'absolute right-4 bottom-4 transition-all will-change-transform',
            'animate-affix-appear [--affix-y-from:2] [animation-range-end:6rem] [animation-range-start:2rem]',
          )}
          onClick={() =>
            getScrollContainer()?.scrollTo({top: 0, behavior: 'smooth'})
          }
        >
          <IconArrowUp />
        </Button>
      )}
    </div>
  )
}
