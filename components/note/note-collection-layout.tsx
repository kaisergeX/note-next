'use client'

import {useState, useSyncExternalStore, type ReactNode} from 'react'
import {cn} from 'cn'
import {useLocale, useTranslations} from 'next-intl'
import {useSelectedLayoutSegments} from 'next/navigation'
import {IconChevronDown, IconHistory, IconNotebook} from '@tabler/icons-react'
import {buttonClass} from '~/components/ui/button'
import MenuCustom from '~/components/ui/menu'
import NoteCreateEditor from './note-create'
import NoteSidebar from './note-sidebar'
import DeviceDraftsLink from './device-drafts-link'

const PIN_STORAGE_KEY = 'etoN-sidebar-pinned'
const PIN_EVENT = 'eton-sidebar-preference'

function subscribePin(callback: () => void) {
  window.addEventListener('storage', callback)
  window.addEventListener(PIN_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(PIN_EVENT, callback)
  }
}

function readPin() {
  try {
    return localStorage.getItem(PIN_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export default function NoteCollectionLayout({
  children,
  creationLabel,
  ownerId,
}: {
  children: ReactNode
  creationLabel: string
  ownerId: string
}) {
  const t = useTranslations('note')
  const locale = useLocale()
  const savedPin = useSyncExternalStore(subscribePin, readPin, () => false)
  const [memoryPin, setMemoryPin] = useState<boolean | null>(null)
  const pinned = memoryPin ?? savedPin

  const togglePin = () => {
    const next = !pinned
    setMemoryPin(next)
    try {
      localStorage.setItem(PIN_STORAGE_KEY, String(next))
      window.dispatchEvent(new Event(PIN_EVENT))
      setMemoryPin(null)
    } catch {
      // Keep the toggle usable when browser storage is unavailable.
    }
  }
  // Follow the children slot so an intercepted editor keeps its list backdrop.
  const segments = useSelectedLayoutSegments()
  const section = segments[0]
  const isDrafts =
    section === 'collection' &&
    segments.length === 2 &&
    segments[1] === 'drafts'
  const isTrash =
    section === 'collection' && segments.length === 2 && segments[1] === 'trash'
  const isNoteList = section === 'eton' && segments.length === 1
  if (!isDrafts && !isTrash && !isNoteList) return children

  const isNotes = section === 'eton' || isDrafts
  const currentLabel = isNotes ? t('collections.all') : t('collections.deleted')
  const currentHref = isNotes ? '/eton' : '/collection/trash'
  const CurrentIcon = isNotes ? IconNotebook : IconHistory
  const collections = [
    {href: '/eton', label: t('collections.all'), Icon: IconNotebook},
    {
      href: '/collection/trash',
      label: t('collections.deleted'),
      Icon: IconHistory,
    },
  ]

  return (
    <NoteSidebar
      currentHref={currentHref}
      expanded={pinned}
      onToggle={togglePin}
    >
      <div className="flex min-h-0 flex-1 flex-col p-4 lg:p-6">
        {isNoteList && <h1 className="sr-only">{currentLabel}</h1>}
        {isNoteList && (
          <header
            className={cn(
              'mb-6 flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-2',
              !isNotes && 'lg:hidden',
            )}
          >
            {isNotes && !isDrafts && <DeviceDraftsLink ownerId={ownerId} />}
            <div className={cn('min-w-0 lg:hidden', isDrafts && 'hidden')}>
              <MenuCustom
                anchor="bottom-start"
                ariaLabel={`${t('accessibility.collections')}: ${currentLabel}`}
                className={cn(
                  buttonClass({variant: 'ghost', pressMotion: false}),
                  'px-0 text-base',
                )}
                itemsClassName="w-64 p-1"
                items={collections.map(({href, label, Icon}) => ({
                  type: 'link',
                  url: `/${locale}${href}`,
                  ariaCurrent: currentHref === href ? 'page' : undefined,
                  className: cn(
                    'min-h-10',
                    currentHref === href && 'bg-ink-tint',
                  ),
                  label: (
                    <>
                      <Icon size={18} aria-hidden />
                      <span className="flex-1 text-left">{label}</span>
                    </>
                  ),
                }))}
              >
                <CurrentIcon size={18} aria-hidden />
                {currentLabel}
                <IconChevronDown size={16} aria-hidden />
              </MenuCustom>
            </div>
            {isNotes && !isDrafts && (
              <div className="ml-auto">
                <NoteCreateEditor creationLabel={creationLabel} />
              </div>
            )}
          </header>
        )}
        {children}
      </div>
    </NoteSidebar>
  )
}
