import {redirect} from 'next/navigation'
import {unstable_ViewTransition as ViewTransition} from 'react'
import {auth} from '~/auth'
import NoteCreateEditor from '~/components/note/note-create'
import NoteTiny from '~/components/note/note-tiny'
import {getListNote} from '~/db/helper/notes'
import {getUser} from '~/db/helper/users'
import {genRandom} from '~/util'

export default async function Notes() {
  const session = await auth()
  const userEmail = session?.user?.email
  if (!userEmail) {
    redirect('/denied/permission')
  }

  const userInfo = await getUser(userEmail)
  const notes = await getListNote(userInfo.id)

  const renderNoteList = notes.map((noteData) => (
    <ViewTransition key={`tiny-note-${noteData.id}`}>
      <NoteTiny data={noteData} />
    </ViewTransition>
  ))

  return (
    <main className="h-full p-4 max-sm:pt-0">
      <NoteCreateEditor authorId={userInfo.id} />
      {renderNoteList.length === 0 ? (
        <h3 className="mt-40 text-center opacity-50">
          {genRandom([
            'Nothing here yet 😶‍🌫️',
            "Let's add New💡",
            "Let's add something inspirational ✨",
            "Let's add a todo 📝",
          ])}
        </h3>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(17rem,100%),1fr))] grid-rows-[masonry] gap-4 pb-16">
          {renderNoteList}
        </div>
      )}
    </main>
  )
}
