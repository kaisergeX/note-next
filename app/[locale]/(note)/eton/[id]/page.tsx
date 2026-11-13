import {NextIntlClientProvider} from 'next-intl'
import {getMessages} from 'next-intl/server'
import {ViewTransition} from 'react'
import EncryptedDetail from '~/components/note/encryption/encrypted-detail'
import {notFound} from 'next/navigation'
import {getNote} from '~/db/helper/notes'
import {requireAuth} from '~/server-utils'
import type {PropsWithLocale} from '~/types'
import NoteDetail from './note-detail'

export default async function NoteDetailFullPage(
  props: PropsWithLocale<PageProps<'/[locale]/eton/[id]'>>,
) {
  const {id: noteId, locale} = await props.params
  const {userInfo} = await requireAuth()
  const noteData = await getNote(userInfo.id, noteId)
  if (!noteData) notFound()
  if (noteData.isEncrypted)
    return <EncryptedDetail ownerId={userInfo.id} noteId={noteData.id} />
  const noteMsgs = (await getMessages({locale})).note
  return (
    <NextIntlClientProvider messages={{note: noteMsgs}}>
      <ViewTransition>
        <NoteDetail noteData={noteData} />
      </ViewTransition>
    </NextIntlClientProvider>
  )
}
