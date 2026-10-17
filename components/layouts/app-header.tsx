'use client'

import {useDisclosure} from '@kaiverse/k/hooks'
import {Dialog} from '@kaiverse/k/ui'
import {cn} from 'cn'
import {
  IconActivity,
  IconLogout,
  IconMenu2,
  IconMoonStars,
  IconSun,
  IconUser,
  IconUserCircle,
} from '@tabler/icons-react'
import type {Route} from 'next'
import {useSession} from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {protectedPathnameRegex} from '~/config/auth'
import {usePersistStore} from '~/store'
import {useScrollDirection} from '~/util/hooks'
import Button from '~/components/ui/button'
import SignOutButton from '../auth/signout-button'
import MenuCustom, {type MenuCustomItem} from '../ui/menu'

type NavProps = {
  appName: string
  signOutLabel: string
}

export default function AppHeader({appName, signOutLabel}: NavProps) {
  const {status, data: sessionData} = useSession()
  const pathName = usePathname()
  const isAuthenticated = status === 'authenticated' && !sessionData?.error
  const userRole = sessionData?.user.role
  const profileName = sessionData?.user.name
  const profileAvatar =
    sessionData?.user.image ??
    (profileName
      ? `https://ui-avatars.com/api/?name=${profileName}`
      : undefined)

  const {isDarkMode, setTheme} = usePersistStore((s) => ({
    isDarkMode: s.theme === 'dark',
    setTheme: s.setTheme,
  }))

  const [isMenuDialogOpen, {open: openMenuDialog, close: closeMenuDialog}] =
    useDisclosure()

  const scrollDirection = useScrollDirection({
    threshold: 100,
    defaultDirection: 'up',
  })

  const homepagePath = (
    protectedPathnameRegex.test(pathName)
      ? `/?utm_source=${pathName}&p_r=true`
      : '/'
  ) as Route

  const desktopMenuItems: MenuCustomItem[] = [
    {
      type: 'link',
      url: '/user',
      label: (
        <>
          <IconUserCircle /> Profile
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
        <SignOutButton className="text-destructive hover:bg-destructive hover:text-paper focus-visible:bg-destructive focus-visible:text-paper focus-visible:outline-accent flex w-full items-center gap-2 rounded-sm bg-transparent p-3 text-left font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45">
          <IconLogout /> {signOutLabel}
        </SignOutButton>
      ),
    },
  ]

  const renderAvatar = profileAvatar
    ? {
        container: '',
        avatar: (
          <Image
            src={profileAvatar}
            alt={profileName || sessionData?.user.email || 'profile-avatar'}
            width={34}
            height={34}
            className="ring-hairline rounded-full ring-1"
          />
        ),
      }
    : {
        container:
          'flex size-[34px] items-center justify-center rounded-full bg-ink text-paper',
        avatar: <IconUser />,
      }

  return (
    <header
      className={cn(
        'bg-paper border-hairline animate-header-shadow sticky inset-x-0 top-0 z-20 w-full border-b transition-transform',
        'flex h-16 items-center justify-between gap-4 p-4',
        scrollDirection === 'down' ? '-translate-y-full' : '',
      )}
    >
      <Link
        href={homepagePath}
        className="text-2xl font-medium max-lg:hidden md:text-4xl"
      >
        <span className="text-accent inline-block font-serif">{appName}</span>
      </Link>

      <Link href={homepagePath} className="lg:hidden">
        <Image
          className="dark:invert"
          src="/favicon.svg"
          alt={appName}
          loading="eager"
          width={48}
          height={48}
        />
      </Link>

      <div className="flex items-center gap-4">
        <Button
          variant="secondary"
          size="md"
          iconOnly
          className="min-h-11 min-w-11"
          onClick={() => setTheme(isDarkMode ? 'light' : 'dark')}
          aria-label="Theme Switcher"
        >
          {isDarkMode ? <IconMoonStars /> : <IconSun />}
        </Button>

        <div className={isAuthenticated ? '' : 'hidden'}>
          {/* Profile dropdown */}
          <nav className="hidden lg:block">
            <MenuCustom
              className={cn(
                'flex items-center rounded-full',
                renderAvatar.container,
              )}
              itemsClassName="w-48 sm:mt-4"
              items={desktopMenuItems}
            >
              <span className="sr-only">Open user menu</span>
              {renderAvatar.avatar}
            </MenuCustom>
          </nav>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="md"
            iconOnly
            className="min-h-11 min-w-11 lg:hidden"
            onClick={openMenuDialog}
            aria-controls="main-menu"
            aria-expanded={isMenuDialogOpen}
            aria-label="Open main menu"
          >
            <IconMenu2 size="1.5rem" />
          </Button>
        </div>
      </div>

      <Dialog
        id="main-menu"
        className="bg-paper-raised border-hairline shadow-sheet text-ink pt-[calc(.5rem+env(safe-area-inset-top))] max-xl:pb-[calc(1rem+env(safe-area-inset-bottom))]"
        open={isMenuDialogOpen}
        onClose={closeMenuDialog}
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
            <Dialog.CloseButton className="[&>svg]:size-8" />
          </div>
          <div className="border-hairline flex gap-4 border-b px-4 py-8">
            <div className={renderAvatar.container}>{renderAvatar.avatar}</div>
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
          <nav aria-label="Main navigation">
            <Link
              href="/user"
              className="flex items-center gap-2 rounded-md p-3 text-base font-medium"
              onClick={closeMenuDialog}
            >
              <IconUserCircle /> Profile
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

          <div className="border-hairline border-t">
            <SignOutButton className="text-destructive hover:bg-destructive hover:text-paper focus-visible:bg-destructive focus-visible:text-paper focus-visible:outline-accent flex w-full items-center gap-2 rounded-md border border-transparent bg-transparent p-3 text-left text-base font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45">
              <IconLogout /> {signOutLabel}
            </SignOutButton>
          </div>
        </Dialog.Content>
      </Dialog>
    </header>
  )
}
