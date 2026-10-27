'use client'

import {cn} from 'cn'
import {
  IconArrowUp,
  IconCheck,
  IconDotsVertical,
  IconLoader2,
  IconPencil,
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
import {noteDraftChanged} from './use-note-session'
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
  const draft = usePersistStore((state) => state.mutateNoteData)
  const session = usePersistStore((state) => state.noteSession)
  const dirty = session ? noteDraftChanged(draft, session.baseline) : false
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
      destructive: true,
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
          title={t('editor.texture')}
          disabled
        >
          <IconTexture size="18" />
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
        {details}
        <div
          role="status"
          className="flex items-center gap-1 text-xs font-medium"
        >
          {isLoading ? (
            <>
              <IconLoader2
                className="animate-spin motion-reduce:animate-none"
                size="1.2rem"
              />
              {t(
                session?.operation === 'trash'
                  ? 'status.moving'
                  : 'status.saving',
              )}
            </>
          ) : error ? (
            <span className="text-destructive">{t('status.failed')}</span>
          ) : dirty ? (
            <>
              <IconPencil size="1rem" aria-hidden />
              {t('status.pending')}
            </>
          ) : type === 'create' ? (
            t('status.draft')
          ) : (
            <>
              <IconCheck className="text-success" size="1.2rem" />
              {t('status.saved')}
            </>
          )}
        </div>

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
              'shadow-sheet',
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
          aria-label={t('editor.scrollTop')}
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
