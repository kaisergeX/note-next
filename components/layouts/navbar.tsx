'use client'
import {Disclosure, Menu, Transition} from '@headlessui/react'
import {IconMenu2, IconX} from '@tabler/icons-react'
import {IconMoonStars, IconSun} from '@tabler/icons-react'
import Link from 'next/link'
import {Fragment} from 'react'
import {usePersistStore} from '~/store'
import {classNames} from '~/util'
import SignOutButton from '../auth/signout-button'
import {useSession} from 'next-auth/react'

export default function Navbar({signOutLabel}: {signOutLabel: string}) {
  const {status} = useSession()
  const isUnAuthenticated = status === 'unauthenticated'

  const {theme, setTheme} = usePersistStore()
  const isDarkMode = theme === 'dark'

  const userNavigation = [
    {name: 'Your Profile', href: '/users'},
    {name: 'Sign out', href: '#'},
  ]

  const user = {
    name: 'Tom Cook',
    email: 'tom@example.com',
    imageUrl:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
  }
  // className=""
  return (
    <Disclosure
      as="nav"
      className="md:glass sticky top-0 z-10 bg-white dark:bg-inherit"
    >
      {({open}) => (
        <>
          <div className="flex h-16 items-center justify-between gap-4 p-4">
            <Link href="/">
              <span className="bg-gradient-to-r from-rose-500 to-violet-500 bg-clip-text text-2xl font-bold text-transparent md:text-4xl">
                eotN
              </span>
            </Link>

            <div className="flex items-center gap-4">
              <button
                type="button"
                className="button rounded-full p-1"
                onClick={() => setTheme(isDarkMode ? 'light' : 'dark')}
              >
                <span className="sr-only">Theme Switcher</span>
                {isDarkMode ? (
                  <IconMoonStars size="1.625rem" />
                ) : (
                  <IconSun size="1.625rem" />
                )}
              </button>

              {/* Profile dropdown */}
              <Menu
                as="div"
                className={classNames(
                  isUnAuthenticated ? 'hidden' : 'hidden md:block',
                  'relative',
                )}
              >
                <Menu.Button className="button-secondary flex max-w-xs items-center rounded-full">
                  <span className="sr-only">Open user menu</span>
                  <span>Avatar</span>
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
                  <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <Menu.Item>
                      {({active}) => (
                        <Link
                          href="/users"
                          className={classNames(
                            active ? 'bg-gray-100' : '',
                            'block px-4 py-2 text-sm text-gray-700',
                          )}
                        >
                          User Management
                        </Link>
                      )}
                    </Menu.Item>

                    <Menu.Item as="div">
                      {({active}) => (
                        <SignOutButton
                          className={classNames(
                            active ? 'bg-gray-100' : '',
                            'block w-full px-4 py-2 text-left text-sm text-gray-700',
                          )}
                        >
                          {signOutLabel}
                        </SignOutButton>
                      )}
                    </Menu.Item>

                    {/* <Menu.Item as="div">
                      <SignOutButton className="block w-full px-4 py-2 text-left text-sm text-gray-700">
                        {signOutLabel}
                      </SignOutButton>
                    </Menu.Item> */}
                  </Menu.Items>
                </Transition>
              </Menu>

              {/* Mobile menu button */}
              <Disclosure.Button className="flex items-center justify-center rounded-md bg-gray-800 p-1 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800 md:hidden">
                <span className="sr-only">Open main menu</span>
                {open ? <IconX size="1.5rem" /> : <IconMenu2 size="1.5rem" />}
              </Disclosure.Button>
            </div>
          </div>

          <Disclosure.Panel className="absolute w-full md:hidden">
            <div className="border-t border-gray-700 py-4">
              <div className="flex gap-4 px-4">
                <div>Avatar</div>
                <div>
                  <div className="text-base font-medium leading-none">
                    {user.name}
                  </div>
                  <div className="mt-1 text-sm font-medium leading-none text-gray-400">
                    {user.email}
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-1">
                {userNavigation.map((item) => (
                  <Disclosure.Button
                    key={item.name}
                    as={Link}
                    href={item.href}
                    className="block rounded-md px-4 py-2 text-base font-medium text-gray-400 hover:bg-gray-700 hover:text-white"
                  >
                    {item.name}
                  </Disclosure.Button>
                ))}

                <Disclosure.Button
                  as={Link}
                  href="/users"
                  className="block rounded-md px-4 py-2 text-base font-medium text-gray-400 hover:bg-gray-700 hover:text-white"
                >
                  User Management
                </Disclosure.Button>
                <hr />
                <Disclosure.Button
                  className="block rounded-md px-4 py-2 text-base font-medium text-gray-400 hover:bg-gray-700 hover:text-white"
                  as={SignOutButton}
                >
                  {signOutLabel}
                </Disclosure.Button>
              </div>
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  )
}
