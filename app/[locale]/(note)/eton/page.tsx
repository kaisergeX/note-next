import {getServerSession} from 'next-auth'
import {redirect} from 'next/navigation'
import NoteCreateEditor from '~/components/note/note-create'
import NoteTiny from '~/components/note/note-tiny'
import {authOptions} from '~/config/auth'
import {getListNote} from '~/db/helper/notes'
import {getUser} from '~/db/helper/users'
import {genRandom} from '~/util'

export default async function Notes() {
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email
  if (!userEmail) {
    redirect('/denied')
  }

  const userInfo = await getUser(userEmail)
  const notes = await getListNote(userInfo.id)

  const renderNoteList = notes.map((noteData) => (
    <NoteTiny key={noteData.id} data={noteData} />
  ))

  return (
    <main className="h-full p-4">
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
        <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,_1fr))] grid-rows-[masonry] gap-4 pb-8">
          {renderNoteList}
        </div>
      )}
    </main>
  )
}
