import {NextIntlClientProvider} from 'next-intl'
import {getMessages} from 'next-intl/server'
import {encryptionRepository} from '~/lib/notes/encryption/server-http'
import NotesCollection from '~/components/note/notes-collection'
import {requireAuth} from '~/server-utils'
import type {PropsWithLocale} from '~/types'

export default async function BrowserWorkPage({params}: PropsWithLocale) {
  const {userInfo} = await requireAuth()
  const locale = (await params).locale
  const noteMsgs = (await getMessages({locale})).note
  return (
    <main className="body-h-auto w-full p-4 lg:p-6">
      <NextIntlClientProvider messages={{note: noteMsgs}}>
        <NotesCollection
          encryptionAvailable={
            process.env.NOTE_ENCRYPTION_ENROLLMENT_ENABLED === 'true' ||
            Boolean(await encryptionRepository.getVault(userInfo.id))
          }
          ownerId={userInfo.id}
          browserWorkOnly
        />
      </NextIntlClientProvider>
    </main>
  )
}
