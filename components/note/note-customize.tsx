'use client'

import {classNames} from '@kaiverse/k/utils'
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
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type RefObject,
} from 'react'
import {deleteNoteAction} from '~/app/[locale]/(note)/eton/actions'
import {usePersistStore} from '~/store'
import {NoteThemePicker} from './note-theme-picker'

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <div className="flex items-center gap-2">
        <NoteThemePicker prefixId={`dialog-${type}`} disabled={isLoading} />

        <button
          className={`button-secondary button-icon rounded-full p-1 border-theme-${theme}`}
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
                'position-try-y-[top_span-left] position-anchor-(--anchor-name) absolute inset-auto mb-2',
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
