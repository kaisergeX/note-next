import {cn} from 'cn'
import {IconNoteOff, IconUserCircle, IconUserOff} from '@tabler/icons-react'
import type {Route} from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {NextIntlClientProvider} from 'next-intl'
import {getLocale, getMessages} from 'next-intl/server'
import {Badge} from '~/components/ui/badge'
import Button from '~/components/ui/button'
import AppearanceSettings from '~/components/settings/appearance-settings'
import {requireAuth} from '~/server-utils'

export default async function MyProfile() {
  const {userInfo} = await requireAuth()
  const locale = await getLocale()
  const messages = await getMessages({locale})

  // @todo store user preferences/settings, KV or Postgres?
  // @todo Add a option on setting page for user to choose whether to use Dialog or not.

  const renderSettings = settings.map(({id, name, href}, index) => (
    <Link
      key={id}
      className={cn(
        'border-hairline flex-center min-h-24 rounded-lg border p-4 transition-colors',
        index % 2 === 0
          ? 'bg-paper-raised hover:bg-raised-hover hover:text-inherit'
          : 'bg-ink text-paper hover:bg-ink-hover',
      )}
      href={href as Route}
    >
      <h3>{name}</h3>
    </Link>
  ))

  return (
    <main className="p-4 [&>hr]:my-6">
      <div className="flex-center py-10">
        {userInfo.image ? (
          <Image
            className="border-hairline rounded-full border"
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
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(min(16rem,100%),1fr))] justify-center gap-4">
        {renderSettings}
      </div>
      <hr />
      <NextIntlClientProvider messages={{user: messages.user}}>
        <AppearanceSettings />
      </NextIntlClientProvider>
      <hr />

      <h2 className="text-destructive">Danger Zone</h2>
      <div className="mt-4 flex flex-wrap gap-4">
        <Button variant="danger" disabled>
          <IconNoteOff /> Remove all notes
        </Button>
        <Button variant="danger" disabled>
          <IconUserOff /> Delete account
        </Button>
      </div>
    </main>
  )
}

const settings = [
  {
    id: 1,
    href: '#',
    name: 'Account Info',
  },
  {
    id: 3,
    href: '#',
    name: 'Notes',
  },
]
