'use client'

import {useDisclosure} from '@kaiverse/k/hooks'
import {Dialog} from '@kaiverse/k/ui'
import {
  IconActivity,
  IconCheck,
  IconLogout,
  IconMenu2,
  IconMoonStars,
  IconSun,
  IconUser,
  IconSettings,
  IconPalette,
} from '@tabler/icons-react'
import {cn} from 'cn'
import {useSession} from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {type KeyboardEvent, useEffect, useState} from 'react'
import Button, {buttonClass} from '~/components/ui/button'
import {protectedPathnameRegex} from '~/config/auth'
import {usePersistStore} from '~/store'
import {useScrollDirection} from '~/util/hooks'
import SignOutButton from '../auth/signout-button'
import MenuCustom, {type MenuCustomItem} from '../ui/menu'
import {
  getAppNavigation,
  isNavigationActive,
  isNoteCollectionPath,
  type AppNavigationLabels,
} from './app-navigation'

type NavProps = {
  appName: string
  signOutLabel: string
  navigationLabels: {
    switchTheme: string
    openMainMenu: string
    closeMainMenu: string
    languageSwitch: string
    login: string
    settings: string
    appearance: string
  } & AppNavigationLabels
}

export default function AppHeader({
  appName,
  signOutLabel,
  navigationLabels,
}: NavProps) {
  const {status, data: sessionData} = useSession()
  const pathName = usePathname()
  const localeMatch = pathName.match(/^\/(en|vi)(?=\/|$)/)
  const locale = localeMatch?.[1] ?? 'en'
  const localizedPath = localeMatch
    ? pathName.slice(localeMatch[0].length)
    : pathName === '/'
      ? ''
      : pathName
  const isLandingPage = localizedPath === '' || localizedPath === '/'
  const isAuthenticated = status === 'authenticated' && !sessionData?.error
  const userRole = sessionData?.user.role
  const profileName = sessionData?.user.name
  const profileAvatar =
    sessionData?.user.image ??
    (profileName
      ? `https://ui-avatars.com/api/?name=${profileName}`
      : undefined)

  const {mode, setMode} = usePersistStore((s) => ({
    mode: s.mode,
    setMode: s.setMode,
  }))
  const [systemPrefersDark, setSystemPrefersDark] = useState(false)
  const isDarkMode = mode === 'dark' || (mode === 'system' && systemPrefersDark)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemMode = () => setSystemPrefersDark(media.matches)
    updateSystemMode()
    media.addEventListener('change', updateSystemMode)
    return () => media.removeEventListener('change', updateSystemMode)
  }, [])

  const [isMenuDialogOpen, {open: openMenuDialog, close: closeMenuDialog}] =
    useDisclosure()

  const handleMenuDialogKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return

    const dialog = event.currentTarget
    const focusableElements = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.getClientRects().length > 0)

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    if (!firstElement || !lastElement) return

    const activeElement = document.activeElement
    if (!dialog.contains(activeElement)) {
      event.preventDefault()
      const wrappedElement = event.shiftKey ? lastElement : firstElement
      wrappedElement.focus()
      return
    }

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    } else if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }

  const scrollDirection = useScrollDirection({
    threshold: 100,
    defaultDirection: 'up',
  })

  const homepagePath = `/${locale}/${
    protectedPathnameRegex.test(pathName) ? `?utm_source=${pathName}` : ''
  }`

  const desktopMenuItems: MenuCustomItem[] = [
    {
      type: 'link',
      url: `/${locale}/settings/account`,
      label: (
        <>
          <IconSettings /> {navigationLabels.settings}
        </>
      ),
    },
    {
      type: 'link',
      url: '/admin',
      label: (
        <>
          <IconActivity /> Admin Portal
        </>
      ),
      hidden: userRole !== 'archivist',
    },
    {
      component: (
        <SignOutButton>
          <IconLogout /> {signOutLabel}
        </SignOutButton>
      ),
    },
  ]

  const renderAvatar = profileAvatar ? (
    <Image
      src={profileAvatar}
      alt={profileName || sessionData?.user.email || 'profile-avatar'}
      width={34}
      height={34}
      className="rounded-full"
    />
  ) : (
    <IconUser />
  )

  return (
    <header
      className={cn(
        'bg-paper border-hairline animate-header-shadow sticky inset-x-0 top-0 z-20 w-full border-b transition-transform',
        'flex h-16 items-center justify-between gap-4 p-4',
        scrollDirection === 'down' && !isNoteCollectionPath(localizedPath)
          ? '-translate-y-full'
          : '',
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <Link
          href={homepagePath}
          className="focus-visible:outline-accent text-2xl font-medium focus-visible:outline-2 focus-visible:outline-offset-2 max-lg:hidden md:text-4xl"
        >
          <span className="text-accent inline-block font-serif">{appName}</span>
        </Link>

        <Link
          href={homepagePath}
          className="focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2 lg:hidden"
        >
          <Image
            className="dark:invert"
            src="/favicon.svg"
            alt={appName}
            loading="eager"
            width={48}
            height={48}
          />
        </Link>

        {isAuthenticated && (
          <nav
            aria-label={navigationLabels.navigation}
            className="hidden items-center gap-1 lg:flex"
          >
            {getAppNavigation(navigationLabels).map(({href, label}) => (
              <Link
                key={href}
                href={`/${locale}${href}`}
                aria-current={
                  isNavigationActive(localizedPath, href) ? 'page' : undefined
                }
                className={cn(
                  'focus-visible:outline-accent inline-flex h-10 items-center gap-2 px-2 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
                  isNavigationActive(localizedPath, href)
                    ? 'text-ink font-bold'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
      </div>
      <div className="flex items-center gap-3">
        <MenuCustom
          ariaLabel={navigationLabels.languageSwitch}
          className={cn(
            buttonClass({variant: 'ghost', size: 'sm', iconOnly: true}),
            'text-sm',
          )}
          itemsClassName="w-48 p-1"
          items={[
            {
              type: 'link',
              url: `/en${localizedPath}`,
              lang: 'en',
              ariaCurrent: locale === 'en' ? 'page' : undefined,
              className: locale === 'en' ? 'font-semibold' : '',
              label: (
                <>
                  <span className="flex-1">English</span>
                  {locale === 'en' && <IconCheck size={16} aria-hidden />}
                </>
              ),
            },
            {
              type: 'link',
              url: `/vi${localizedPath}`,
              lang: 'vi',
              ariaCurrent: locale === 'vi' ? 'page' : undefined,
              className: locale === 'vi' ? 'font-semibold' : '',
              label: (
                <>
                  <span className="flex-1">Tiếng Việt</span>
                  {locale === 'vi' && <IconCheck size={16} aria-hidden />}
                </>
              ),
            },
          ]}
        >
          <span>{locale.toUpperCase()}</span>
        </MenuCustom>

        {!isAuthenticated && isLandingPage && (
          <Link
            href={`/${locale}/login`}
            className="text-ink-muted hover:text-ink focus-visible:outline-accent inline-flex min-h-11 items-center justify-center rounded-md px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {navigationLabels.login}
          </Link>
        )}

        {!isAuthenticated && (
          <Link
            href={`/${locale}/settings/appearance`}
            className={buttonClass({variant: 'ghost', iconOnly: true})}
            aria-label={navigationLabels.appearance}
            title={navigationLabels.appearance}
          >
            <IconPalette aria-hidden />
          </Link>
        )}

        <Button
          variant="secondary"
          size="sm"
          iconOnly
          onClick={() => setMode(isDarkMode ? 'light' : 'dark')}
          aria-label={navigationLabels.switchTheme}
        >
          {isDarkMode ? <IconMoonStars /> : <IconSun />}
        </Button>

        {isAuthenticated && (
          <>
            {/* Profile dropdown */}
            <MenuCustom
              className={cn(
                'max-lg:hidden',
                buttonClass({
                  variant: 'ghost',
                  size: 'sm',
                  iconOnly: true,
                }),
              )}

              itemsClassName="w-48 sm:mt-1"
              items={desktopMenuItems}
            >
              <span className="sr-only">Open user menu</span>
              {renderAvatar}
            </MenuCustom>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              iconOnly
              size="sm"
              className="lg:hidden"
              onClick={openMenuDialog}
              aria-controls="main-menu"
              aria-expanded={isMenuDialogOpen}
              aria-label={navigationLabels.openMainMenu}
            >
              <IconMenu2 />
            </Button>
          </>
        )}
      </div>

      <Dialog
        id="main-menu"
        className="bg-paper-raised border-hairline shadow-sheet text-ink pt-[calc(.5rem+env(safe-area-inset-top))] max-xl:pb-[calc(1rem+env(safe-area-inset-bottom))]"
        open={isMenuDialogOpen}
        onClose={closeMenuDialog}
        onKeyDown={handleMenuDialogKeyDown}
        variant="drawer"
        position="right"
      >
        <header className="border-hairline block border-b">
          <div className="border-hairline flex items-center justify-between border-b px-4 pb-2">
            <Image
              className="dark:invert"
              src="/favicon.svg"
              alt={appName}
              width={48}
              height={48}
            />
            <Dialog.CloseButton
              className="size-10 [&>svg]:size-5"
              aria-label={navigationLabels.closeMainMenu}
            />
          </div>
          <div className="border-hairline flex items-center gap-3 border-b px-4 py-8">
            {renderAvatar}
            <div>
              <div className="leading-none">{profileName}</div>
              {sessionData?.user.email && (
                <div className="text-ink-muted mt-2 text-sm leading-none font-medium">
                  {sessionData.user.email}
                </div>
              )}
            </div>
          </div>
        </header>
        <Dialog.Content className="flex flex-col justify-between gap-1">
          <nav aria-label={navigationLabels.navigation}>
            {getAppNavigation(navigationLabels).map(({href, label}) => (
              <Link
                key={href}
                href={`/${locale}${href}`}
                aria-current={
                  isNavigationActive(localizedPath, href) ? 'page' : undefined
                }
                className={cn(
                  'focus-visible:outline-accent flex min-h-11 w-full items-center gap-2 px-3 py-2 text-base whitespace-normal transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
                  isNavigationActive(localizedPath, href)
                    ? 'text-ink font-bold'
                    : 'text-ink-muted hover:text-ink',
                )}
                onClick={closeMenuDialog}
              >
                {label}
              </Link>
            ))}
            <Link
              href={`/${locale}/settings/account`}
              className="flex items-center gap-2 rounded-md p-3 text-base font-medium"
              onClick={closeMenuDialog}
            >
              <IconSettings /> {navigationLabels.settings}
            </Link>

            {userRole === 'archivist' && (
              <Link
                href="/admin"
                className="flex items-center gap-2 rounded-md p-3 text-base font-medium"
                onClick={closeMenuDialog}
              >
                <IconActivity /> Admin Portal
              </Link>
            )}
          </nav>

          <div className="border-hairline border-t py-2">
            <SignOutButton className="rounded-lg">
              <IconLogout /> {signOutLabel}
            </SignOutButton>
          </div>
        </Dialog.Content>
      </Dialog>
    </header>
  )
}
