import {NextIntlClientProvider} from 'next-intl'
import {getMessages} from 'next-intl/server'
import NotesCollection from '~/components/note/notes-collection'
import {getListNote} from '~/db/helper/notes'
import {requireAuth} from '~/server-utils'
import type {PropsWithLocale} from '~/types'
import {redirect} from '~/i18n/navigation'

export default async function Notes({
  params,
  searchParams,
}: PropsWithLocale<PageProps<'/[locale]/eton'>>) {
  const {userInfo} = await requireAuth()
  const locale = (await params).locale
  if ((await searchParams).work === 'browser')
    redirect({href: '/collection/browser-work', locale})
  const notes = await getListNote(userInfo.id)
  const noteMsgs = (await getMessages({locale})).note
  return (
    <main className="body-h-auto">
      <NextIntlClientProvider messages={{note: noteMsgs}}>
        <NotesCollection ownerId={userInfo.id} notes={notes} />
      </NextIntlClientProvider>
    </main>
  )
}
