import {classNames} from '@kaiverse/k/utils'
import {
  IconBrush,
  IconNoteOff,
  IconUserCircle,
  IconUserOff,
} from '@tabler/icons-react'
import Image from 'next/image'
import Link from 'next/link'
import Badge from '~/components/ui/badge'
import {getUser} from '~/db/helper/users'
import {requireAuth} from '~/util'

export default async function MyProfile() {
  const session = await requireAuth()
  const userEmail = session.user.email
  const userInfo = await getUser(userEmail)

  // @todo store user preferences/settings, KV or Postgres?

  const renderSettings = settings.map(({id, name, href}, index) => (
    <Link
      key={id}
      className={classNames(
        'card group relative flex min-h-80 flex-col-reverse overflow-hidden transition-colors hover:text-inherit',
        index % 2 === 0
          ? 'bg-default hover:bg-theme duration-500'
          : 'bg-reverse',
      )}
      href={href}
    >
      {/* {image} */}
      <h3
        className={classNames(
          'px-4 transition-colors duration-200',
          index % 2 === 0 ? 'group-hover:bg-reverse' : 'group-hover:bg-default',
        )}
      >
        {name}
      </h3>
    </Link>
  ))

  return (
    <main className="p-4 [&>hr]:my-6">
      <div className="flex-center py-10">
        {userInfo.image ? (
          <Image
            className="rounded-full ring-1 ring-gray-900/5"
            src={userInfo.image}
            alt="your-profile-avatar"
            width={80}
            height={80}
            priority
          />
        ) : (
          <IconUserCircle className="opacity-70" size="4rem" />
        )}

        <div>
          <div className="flex items-center gap-2">
            <h1>{userInfo.name}</h1>
            <Badge className="capitalize">{userInfo.role}</Badge>
          </div>
          <span>{userInfo.email}</span>
        </div>
      </div>
      <hr />
      <h2>Setting</h2>
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(16rem,100%),1fr))] gap-4">
        {renderSettings}
      </div>
      <hr />

      <h2 className="text-red-500">Danger Zone</h2>
      <div className="mt-4 flex gap-4 [&>button]:text-red-500">
        <button className="button-secondary" type="button" disabled>
          <IconNoteOff /> Remove all notes
        </button>
        <button className="button-secondary" type="button" disabled>
          <IconUserOff /> Delete account
        </button>
      </div>
    </main>
  )
}

const settings = [
  {
    id: 1,
    href: '#',
    name: 'Account Info',
    image: <IconBrush size="full" />,
  },
  {
    id: 2,
    href: '#',
    name: 'Theme',
  },
  {
    id: 3,
    href: '#',
    name: 'Notes',
  },
]
