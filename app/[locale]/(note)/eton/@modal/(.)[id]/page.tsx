import {NextIntlClientProvider} from 'next-intl'
import {getMessages} from 'next-intl/server'
import {ViewTransition} from 'react'
import {notFound} from 'next/navigation'
import {getNote} from '~/db/helper/notes'
import {requireAuth} from '~/server-utils'
import type {PropsWithLocale} from '~/types'
import NoteDetailModal from './note-detail-modal'

export default async function NoteDetailModalPage(
  props: PropsWithLocale<PageProps<'/[locale]/eton/[id]'>>,
) {
  const {id: noteId, locale} = await props.params
  const {userInfo} = await requireAuth()
  const noteData = await getNote(userInfo.id, noteId)
  if (!noteData) notFound()
  const noteMsgs = (await getMessages({locale})).note
  return (
    <NextIntlClientProvider messages={{note: noteMsgs}}>
      <ViewTransition>
        <NoteDetailModal noteData={noteData} />
      </ViewTransition>
    </NextIntlClientProvider>
  )
}
