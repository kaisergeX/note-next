'use client'
import {Disclosure} from '@headlessui/react'
import {
  IconActivity,
  IconLogout,
  IconMenu2,
  IconUser,
  IconX,
} from '@tabler/icons-react'
import {IconMoonStars, IconSun} from '@tabler/icons-react'
import Link from 'next/link'
import {usePersistStore} from '~/store'
import SignOutButton from '../auth/signout-button'
import {useSession} from 'next-auth/react'
import {usePathname} from 'next/navigation'
import {protectedPathnameRegex} from '~/config/auth'
import Image from 'next/image'
import {IconUserCircle} from '@tabler/icons-react'
import MenuCustom, {type MenuItem} from '../ui/menu'

type NavProps = {
  appName: string
  signOutLabel: string
}

export default function Navbar({appName, signOutLabel}: NavProps) {
  const {status, data} = useSession()
  const pathName = usePathname()
  const isAuthenticated = status === 'authenticated'

  const userRole = data?.user?.role
  const profileName = data?.user?.name
  const profileAvatar =
    data?.user?.image ??
    (profileName
      ? `https://ui-avatars.com/api/?name=${profileName}`
      : undefined)

  const {theme, setTheme} = usePersistStore()
  const isDarkMode = theme === 'dark'

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
        <SignOutButton className="ui-active:bg-reverse hover:bg-reverse flex w-full items-center gap-2 p-4 text-left text-red-500 transition-colors ui-disabled:disabled">
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
            alt={profileName || data?.user?.email || 'profile-avatar'}
            width={34}
            height={34}
            className="rounded-full ring-1 ring-gray-900/5"
          />
        ),
      }
    : {container: 'button button-icon p-1', avatar: <IconUser />}

  return (
    <Disclosure
      as="nav"
      className="glass sticky inset-x-0 top-0 z-10 w-full
        ui-open:fixed ui-open:bg-white dark:ui-open:bg-inherit sm:ui-open:bg-inherit"
    >
      {({open}) => (
        <>
          <div className="flex h-16 items-center justify-between gap-4 p-4">
            <Link
              href={homepagePath}
              className="group text-2xl font-bold md:text-4xl"
            >
              <span className="text-gradient inline-block text-inherit transition-colors group-hover:text-transparent dark:hidden">
                {appName}
              </span>

              <span className="hidden dark:inline-block">{appName}</span>
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
                  as="div"
                  className={`flex items-center rounded-full ${renderAvatar.container}`}
                  menuClassName="hidden md:block"
                  itemsClassName="z-10 w-48"
                  items={desktopMenuItems}
                >
                  <span className="sr-only">Open user menu</span>
                  {renderAvatar.avatar}
                </MenuCustom>

                {/* Mobile menu button */}
                <Disclosure.Button className="button-secondary button-icon flex-center p-1 md:hidden">
                  <span className="sr-only">Open main menu</span>
                  {open ? <IconX size="1.5rem" /> : <IconMenu2 size="1.5rem" />}
                </Disclosure.Button>
              </div>
            </div>
          </div>

          <Disclosure.Panel className="sm-only:prevent-body-scroll absolute w-full bg-white shadow-[0_8px_5px_-5px] shadow-slate-100 dark:bg-inherit dark:shadow-slate-700 md:hidden">
            <div className="flex h-[calc(100dvh-4rem)] flex-col border-t border-gray-700">
              <div className="flex gap-4 border-b border-zinc-200 px-4 py-8 dark:border-zinc-700">
                <div className={renderAvatar.container}>
                  {renderAvatar.avatar}
                </div>
                <div>
                  <div className="leading-none">{profileName}</div>
                  {data?.user?.email && (
                    <div className="mt-2 text-sm font-medium leading-none text-zinc-400">
                      {data.user.email}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex h-full flex-col justify-between space-y-1">
                <div>
                  <Disclosure.Button
                    as={Link}
                    href="/user"
                    className="flex items-center gap-2 rounded-md p-4 text-base font-medium"
                  >
                    <IconUserCircle /> Profile
                  </Disclosure.Button>

                  {userRole === 'archivist' && (
                    <Disclosure.Button
                      as={Link}
                      href="/admin"
                      className="flex items-center gap-2 rounded-md p-4 text-base font-medium"
                    >
                      <IconActivity /> Admin Portal
                    </Disclosure.Button>
                  )}
                </div>

                <Disclosure.Button
                  as="div"
                  className="border-t border-zinc-200 dark:border-zinc-700"
                >
                  <SignOutButton className="flex w-full items-center gap-2 rounded-md p-4 text-left text-base font-medium">
                    <IconLogout /> {signOutLabel}
                  </SignOutButton>
                </Disclosure.Button>
              </div>
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  )
}
