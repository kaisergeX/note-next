import TrashList from '~/components/note/trash/trash-list'
import {noteRepository} from '~/db/helper/notes'
import {noteText} from '~/lib/notes/text'
import {requireAuth} from '~/server-utils'

export default async function TrashPage() {
  const {userInfo} = await requireAuth()
  const notes = await noteRepository.getTrashNotes(userInfo.id)
  const serverNow = await noteRepository.getServerTime()
  return (
    <main className="w-full space-y-4">
      <TrashList
        ownerId={userInfo.id}
        items={notes.map((note) => ({
          id: note.id,
          title: noteText(note.title),
          excerpt: noteText(note.content).slice(0, 240),
          deadlineToken: note.deadlineToken!,
          theme: note.theme,
        }))}
        serverNow={serverNow}
      />
    </main>
  )
}
