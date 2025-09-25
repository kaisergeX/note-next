import {getCachedNote} from '~/db/helper/notes'
import NoteDetailModal from './note-detail-modal'

export default async function NoteDetailModalPage(
  props: PageProps<'/[locale]/eton/[id]'>,
) {
  const noteId = (await props.params).id
  const noteData = await getCachedNote(noteId)
  return <NoteDetailModal noteData={noteData} />
}
