import {NextIntlClientProvider} from 'next-intl'
import {getMessages} from 'next-intl/server'
import {getCachedNote} from '~/db/helper/notes'
import type {PropsWithLocale} from '~/types'
import NoteDetail from './note-detail'

export default async function NoteDetailFullPage(
  props: PropsWithLocale<PageProps<'/[locale]/eton/[id]'>>,
) {
  const {id: noteId, locale} = await props.params
  const noteData = await getCachedNote(noteId)
  const noteMsgs = (await getMessages({locale})).note
  return (
    <NextIntlClientProvider messages={{note: noteMsgs}}>
      <NoteDetail noteData={noteData} />
    </NextIntlClientProvider>
  )
}
