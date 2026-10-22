'use client'

import {IconPalette, IconUserCircle} from '@tabler/icons-react'
import {cn} from 'cn'
import {useSession} from 'next-auth/react'
import {Link, usePathname} from '~/i18n/navigation'

export default function SettingsNavigation({
  labels,
}: {
  labels: {navigation: string; account: string; appearance: string}
}) {
  const pathname = usePathname()
  const {data: session, status} = useSession()
  const authenticated = status === 'authenticated' && !session?.error
  return (
    <nav
      aria-label={labels.navigation}
      className="border-hairline flex gap-1 border-b pb-4 md:w-44 md:shrink-0 md:flex-col md:border-r md:border-b-0 md:pr-4 md:pb-0"
    >
      {(
        [
          {
            href: '/settings/account',
            label: labels.account,
            Icon: IconUserCircle,
            hidden: !authenticated,
          },
          {
            href: '/settings/appearance',
            label: labels.appearance,
            Icon: IconPalette,
            hidden: false,
          },
        ] as const
      )
        .filter(({hidden}) => !hidden)
        .map(({href, label, Icon}) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? 'page' : undefined}
            className={cn(
              'focus-visible:outline-accent flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2',
              pathname === href
                ? 'bg-ink-tint text-ink'
                : 'text-ink-muted hover:bg-ink-tint hover:text-ink',
            )}
          >
            <Icon size={18} aria-hidden />
            {label}
          </Link>
        ))}
    </nav>
  )
}
