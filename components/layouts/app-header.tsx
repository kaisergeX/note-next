'use client'

import {useDisclosure} from '@kaiverse/k/hooks'
import {Dialog} from '@kaiverse/k/ui'
import {classNames} from '@kaiverse/k/utils'
import {
  IconActivity,
  IconLogout,
  IconMenu2,
  IconMoonStars,
  IconSun,
  IconUser,
  IconUserCircle,
} from '@tabler/icons-react'
import {useSession} from 'next-auth/react'
import Image from 'next/image'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {protectedPathnameRegex} from '~/config/auth'
import {usePersistStore} from '~/store'
import {useScrollDirection} from '~/util/hooks'
import SignOutButton from '../auth/signout-button'
import MenuCustom, {type MenuItem} from '../ui/menu'

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

  const {theme, setTheme} = usePersistStore()
  const isDarkMode = theme === 'dark'

  const [isMenuDialogOpen, {open: openMenuDialog, close: closeMenuDialog}] =
    useDisclosure()

  const scrollDirection = useScrollDirection({
    threshold: 100,
    defaultDirection: 'up',
  })

  const homepagePath = protectedPathnameRegex.test(pathName)
    ? `/?utm_source=${pathName}&p_r=true`
    : '/'

  const desktopMenuItems: MenuItem[] = [
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
      containerAs: 'div',
      component: (
        <SignOutButton className="data-[active]:bg-reverse hover:bg-reverse data-[disabled]:disabled text-danger flex w-full items-center gap-2 p-4 text-left transition-colors">
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
            className="rounded-full ring-1 ring-gray-900/5"
          />
        ),
      }
    : {container: 'button button-icon p-1', avatar: <IconUser />}

  return (
    <header
      className={classNames(
        'glass sticky inset-x-0 top-0 z-20 w-full transition-transform sm:bg-zinc-50/60 dark:bg-zinc-900/60',
        'flex h-16 items-center justify-between gap-4 p-4',
        scrollDirection === 'down' ? '-translate-y-full' : '',
      )}
    >
      <Link
        href={homepagePath}
        className="group text-2xl font-bold max-lg:hidden md:text-4xl"
      >
        <span className="text-gradient inline-block text-inherit transition-colors group-hover:text-transparent dark:hidden">
          {appName}
        </span>

        <span className="hidden dark:inline-block">{appName}</span>
      </Link>

      <Link href={homepagePath} className="lg:hidden">
        <Image
          className="dark:invert-100"
          src="/favicon.svg"
          alt={appName}
          width={48}
          height={48}
        />
      </Link>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="button-secondary button-icon rounded-full p-1"
          onClick={() => setTheme(isDarkMode ? 'light' : 'dark')}
        >
          <span className="sr-only">Theme Switcher</span>
          {isDarkMode ? <IconMoonStars /> : <IconSun />}
        </button>

        <div className={isAuthenticated ? '' : 'hidden'}>
          {/* Profile dropdown */}
          <MenuCustom
            as="nav"
            className={classNames(
              'flex items-center rounded-full',
              renderAvatar.container,
            )}
            menuClassName="hidden lg:block"
            itemsClassName="w-48 [--anchor-gap:0.5rem] sm:[--anchor-gap:1rem]"
            items={desktopMenuItems}
          >
            <span className="sr-only">Open user menu</span>
            {renderAvatar.avatar}
          </MenuCustom>

          {/* Mobile menu button */}
          <button
            className="button-icon flex-center rounded-full border-none p-1 shadow-none [anchor-name:--anchor-navbar] lg:hidden"
            type="button"
            onClick={openMenuDialog}
            aria-controls="main-menu"
            aria-expanded={isMenuDialogOpen}
          >
            <span className="sr-only">Open main menu</span>
            <IconMenu2 size="1.5rem" />
          </button>
        </div>
      </div>

      <Dialog
        id="main-menu"
        className="dark:bg-theme pt-[calc(.5rem+env(safe-area-inset-top))] text-inherit max-xl:pb-[calc(1rem+env(safe-area-inset-bottom))]"
        open={isMenuDialogOpen}
        onClose={closeMenuDialog}
        variant="drawer"
        position="right"
      >
        <header className="block border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between border-b border-gray-700 px-4 pb-2">
            <Image
              className="dark:invert-100"
              src="/favicon.svg"
              alt={appName}
              width={48}
              height={48}
            />
            <Dialog.CloseButton className="[&>svg]:size-8" />
          </div>
          <div className="flex gap-4 border-b border-zinc-200 px-4 py-8 dark:border-zinc-700">
            <div className={renderAvatar.container}>{renderAvatar.avatar}</div>
            <div>
              <div className="leading-none">{profileName}</div>
              {sessionData?.user.email && (
                <div className="mt-2 text-sm leading-none font-medium text-zinc-400">
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
              className="flex items-center gap-2 rounded-md p-4 text-base font-medium"
              onClick={closeMenuDialog}
            >
              <IconUserCircle /> Profile
            </Link>

            {userRole === 'archivist' && (
              <Link
                href="/admin"
                className="flex items-center gap-2 rounded-md p-4 text-base font-medium"
                onClick={closeMenuDialog}
              >
                <IconActivity /> Admin Portal
              </Link>
            )}
          </nav>

          <div className="border-t border-zinc-200 dark:border-zinc-700">
            <SignOutButton className="text-danger flex w-full items-center gap-2 rounded-md p-4 text-left text-base font-medium">
              <IconLogout /> {signOutLabel}
            </SignOutButton>
          </div>
        </Dialog.Content>
      </Dialog>
    </header>
  )
}
