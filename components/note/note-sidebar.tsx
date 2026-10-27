'use client'

import {
  IconHistory,
  IconNotebook,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from '@tabler/icons-react'
import {cn} from 'cn'
import Link from 'next/link'
import {useLocale, useTranslations} from 'next-intl'
import type {ReactNode} from 'react'
import Button, {buttonClass} from '~/components/ui/button'

export default function NoteSidebar({
  children,
  currentHref,
  expanded,
  onToggle,
}: {
  children: ReactNode
  currentHref: '/eton' | '/collection/trash'
  expanded: boolean
  onToggle: () => void
}) {
  const locale = useLocale()
  const t = useTranslations('note')
  const labels = {
    navigation: t('accessibility.collections'),
  }
  const collections = [
    {href: '/eton', label: t('collections.all'), Icon: IconNotebook},
    {
      href: '/collection/trash',
      label: t('collections.deleted'),
      Icon: IconHistory,
    },
  ]

  return (
    <div className="flex min-h-0 flex-1">
      <div
        className={cn(
          'hidden shrink-0 transition-all motion-reduce:transition-none lg:block',
          expanded ? 'w-60' : 'w-14',
        )}
      >
        <aside
          aria-label={labels.navigation}
          className={cn(
            'group/sidebar border-hairline bg-paper fixed top-16 bottom-0 left-0 z-20 flex flex-col border-r p-2 transition-all motion-reduce:transition-none',
            expanded ? 'w-60' : 'w-14',
          )}
        >
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            pressMotion={false}
            className="pointer-events-none absolute top-1/2 -right-4 -translate-y-1/2 opacity-0 transition-opacity group-hover/sidebar:pointer-events-auto group-hover/sidebar:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 motion-reduce:transition-none pointer-coarse:pointer-events-auto pointer-coarse:opacity-100 pointer-coarse:after:-inset-1.5"
            aria-label={t(
              expanded
                ? 'accessibility.collapseSidebar'
                : 'accessibility.expandSidebar',
            )}
            title={t(
              expanded
                ? 'accessibility.collapseSidebar'
                : 'accessibility.expandSidebar',
            )}
            aria-expanded={expanded}
            aria-controls="note-sidebar-navigation"
            onClick={onToggle}
          >
            {expanded ? (
              <IconLayoutSidebarLeftCollapse size={18} aria-hidden />
            ) : (
              <IconLayoutSidebarLeftExpand size={18} aria-hidden />
            )}
          </Button>
          <nav
            id="note-sidebar-navigation"
            aria-label={labels.navigation}
            className="-m-1 flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto p-1"
          >
            {collections.map(({href, label, Icon}) => {
              const active = currentHref === href
              return (
                <Link
                  key={href}
                  href={`/${locale}${href}`}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                  title={expanded ? undefined : label}
                  className={cn(
                    buttonClass({variant: 'ghost', pressMotion: false}),
                    'w-full min-w-0 shrink-0 justify-start overflow-hidden px-2',
                    href === '/collection/trash' && 'mt-auto',
                    active
                      ? 'bg-ink-tint hover:bg-ink-tint-strong'
                      : 'text-ink-muted hover:text-ink',
                  )}
                >
                  <Icon size={20} className="shrink-0" aria-hidden />
                  <span
                    className={cn(
                      'shrink-0 transition-opacity motion-reduce:transition-none',
                      expanded ? 'opacity-100' : 'opacity-0',
                    )}
                  >
                    {label}
                  </span>
                </Link>
              )
            })}
          </nav>
        </aside>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
