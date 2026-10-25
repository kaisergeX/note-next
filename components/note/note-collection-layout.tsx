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
}: {
  children: ReactNode
  creationLabel: string
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
  if (segments.length !== 1 || (section !== 'eton' && section !== 'trash'))
    return children

  const isNotes = section === 'eton'
  const currentLabel = isNotes ? t('collections.all') : t('collections.deleted')
  const currentHref = isNotes ? '/eton' : '/trash'
  const CurrentIcon = isNotes ? IconNotebook : IconHistory
  const collections = [
    {href: '/eton', label: t('collections.all'), Icon: IconNotebook},
    {href: '/trash', label: t('collections.deleted'), Icon: IconHistory},
  ]

  return (
    <NoteSidebar
      currentHref={currentHref}
      expanded={pinned}
      onToggle={togglePin}
    >
      <div className="flex min-h-0 flex-1 flex-col p-4 lg:p-6">
        <h1 className="sr-only">{currentLabel}</h1>
        <header
          className={cn(
            'mb-6 flex min-h-10 shrink-0 items-center justify-between gap-4',
            isNotes ? 'lg:justify-end' : 'lg:hidden',
          )}
        >
          <div className="min-w-0 lg:hidden">
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
          {isNotes && <NoteCreateEditor creationLabel={creationLabel} />}
        </header>
        {children}
      </div>
    </NoteSidebar>
  )
}
