import {NextIntlClientProvider} from 'next-intl'
import {getMessages} from 'next-intl/server'
import {ViewTransition} from 'react'
import {getCachedNote} from '~/db/helper/notes'
import {requireAuth} from '~/server-utils'
import type {PropsWithLocale} from '~/types'
import NoteDetail from './note-detail'

export default async function NoteDetailFullPage(
  props: PropsWithLocale<PageProps<'/[locale]/eton/[id]'>>,
) {
  const {id: noteId, locale} = await props.params
  const {session} = await requireAuth()
  const noteData = await getCachedNote(session, noteId)
  const noteMsgs = (await getMessages({locale})).note
  return (
    <NextIntlClientProvider messages={{note: noteMsgs}}>
      <ViewTransition>
        <NoteDetail noteData={noteData} />
      </ViewTransition>
    </NextIntlClientProvider>
  )
}
