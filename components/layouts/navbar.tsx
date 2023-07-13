'use client'
import {Disclosure, Menu, Transition} from '@headlessui/react'
import {
  IconLogout,
  IconMenu2,
  IconUser,
  IconUsers,
  IconX,
} from '@tabler/icons-react'
import {IconMoonStars, IconSun} from '@tabler/icons-react'
import Link from 'next/link'
import {Fragment} from 'react'
import {usePersistStore} from '~/store'
import SignOutButton from '../auth/signout-button'
import {useSession} from 'next-auth/react'
import {usePathname} from 'next/navigation'
import {protectedPathnameRegex} from '~/config/auth'
import Image from 'next/image'

type NavProps = {
  appName: string
  signOutLabel: string
}

export default function Navbar({appName, signOutLabel}: NavProps) {
  const {status, data} = useSession()
  const pathName = usePathname()
  const isAuthenticated = status === 'authenticated'

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
      className="glass sticky inset-x-0 top-0 z-10 w-full data-[headlessui-state=open]:fixed data-[headlessui-state=open]:bg-white dark:data-[headlessui-state=open]:bg-inherit sm:data-[headlessui-state=open]:bg-inherit"
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
                <Menu as="div" className="relative hidden md:block">
                  <Menu.Button
                    className={`flex items-center rounded-full ${renderAvatar.container}`}
                  >
                    <span className="sr-only">Open user menu</span>
                    {renderAvatar.avatar}
                  </Menu.Button>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  >
                    <Menu.Items
                      className="bg-default shadow-theme ring-theme absolute right-0 z-10 mt-2 w-48 origin-top-right
                        overflow-hidden rounded-md text-sm font-semibold focus:outline-none"
                    >
                      <Menu.Item>
                        <Link
                          href="/users"
                          className="hover:bg-reverse flex items-center gap-2 p-4 transition-colors"
                        >
                          <IconUsers /> User Management
                        </Link>
                      </Menu.Item>

                      <Menu.Item as="div">
                        <SignOutButton className="hover:bg-reverse flex w-full items-center gap-2 p-4 text-left text-red-500 transition-colors">
                          <IconLogout /> {signOutLabel}
                        </SignOutButton>
                      </Menu.Item>
                    </Menu.Items>
                  </Transition>
                </Menu>

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
                    href="/users"
                    className="flex items-center gap-2 rounded-md p-4 text-base font-medium"
                  >
                    <IconUsers /> User Management
                  </Disclosure.Button>
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
