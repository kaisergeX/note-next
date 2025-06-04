import {getCachedNote} from '~/db/helper/notes'
import type {PropsWithLocale} from '~/types'
import ClientNoteModal from './ClientNote'

export default async function NoteDetailModal(
  props: PropsWithLocale<unknown, {id: string}>,
) {
  const noteId = (await props.params).id
  const data = await getCachedNote(noteId)
  return <ClientNoteModal data={data} />
}
