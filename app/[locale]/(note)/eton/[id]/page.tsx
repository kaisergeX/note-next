import {getCachedNote} from '~/db/helper/notes'
import NoteDetail from './note-detail'
import {getMessages} from 'next-intl/server'
import type {PropsWithLocale} from '~/types'
import {NextIntlClientProvider} from 'next-intl'

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
