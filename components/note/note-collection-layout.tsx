'use client'

import type {ReactNode} from 'react'
import {cn} from 'cn'
import {useLocale, useTranslations} from 'next-intl'
import {useSelectedLayoutSegments} from 'next/navigation'
import {IconChevronDown, IconHistory, IconNotes} from '@tabler/icons-react'
import {Link} from '~/i18n/navigation'
import {buttonClass} from '~/components/ui/button'
import MenuCustom from '~/components/ui/menu'
import NoteCreateEditor from './note-create'

export default function NoteCollectionLayout({
  children,
}: {
  children: ReactNode
}) {
  const locale = useLocale()
  const t = useTranslations('note')
  // Follow the children slot so an intercepted editor keeps its list backdrop.
  const segments = useSelectedLayoutSegments()
  const section = segments[0]
  if (segments.length !== 1 || (section !== 'eton' && section !== 'trash'))
    return children

  const collections = [
    {href: '/eton', label: t('collections.all'), Icon: IconNotes},
    {href: '/trash', label: t('collections.deleted'), Icon: IconHistory},
  ]
  const isNotes = section === 'eton'
  const currentHref = isNotes ? '/eton' : '/trash'
  const currentLabel = isNotes ? t('collections.all') : t('collections.deleted')
  const CurrentIcon = isNotes ? IconNotes : IconHistory
  const collectionClass = (active: boolean) =>
    cn(
      buttonClass({variant: 'ghost', pressMotion: false}),
      'w-full justify-start px-3 font-medium',
      active
        ? 'bg-ink-tint text-ink hover:bg-ink-tint-strong'
        : 'text-ink-muted hover:text-ink',
    )

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4 lg:p-6">
      <div className="flex flex-1 gap-8">
        <aside className="hidden w-56 shrink-0 self-start lg:block">
          <nav
            aria-label={t('accessibility.collections')}
            className="space-y-1"
          >
            {collections.map(({href, label, Icon}) => (
              <Link
                key={href}
                href={href}
                aria-current={currentHref === href ? 'page' : undefined}
                className={collectionClass(currentHref === href)}
              >
                <Icon size={18} aria-hidden />
                <span className="flex-1 text-left">{label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="sr-only">{currentLabel}</h1>
          <header
            className={cn(
              'mb-6 flex h-10 shrink-0 items-center justify-between gap-4',
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
                  className: collectionClass(currentHref === href),
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
            {isNotes && <NoteCreateEditor />}
          </header>
          {children}
        </div>
      </div>
    </div>
  )
}
