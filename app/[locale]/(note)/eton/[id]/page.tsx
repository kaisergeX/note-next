import {getCachedNote} from '~/db/helper/notes'
import NoteDetail from './note-detail'

export default async function NoteDetailFullPage(
  props: PageProps<'/[locale]/eton/[id]'>,
) {
  const noteId = (await props.params).id
  const noteData = await getCachedNote(noteId)
  return <NoteDetail noteData={noteData} />
}
