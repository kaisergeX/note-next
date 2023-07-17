import {getServerSession} from 'next-auth'
import {redirect} from 'next/navigation'
import NoteTiny from '~/components/note/note-tiny'
import {authOptions} from '~/config/auth'
import {getListNote} from '~/db/helper/notes'
import {getUser} from '~/db/helper/users'

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
    <main className="p-4">
      {/* <NoteEditor editorClassName="min-h-[6rem]" placeholder={'placeholder'} /> */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(16rem,_1fr))] grid-rows-[masonry] gap-4">
        {renderNoteList}
      </div>
    </main>
  )
}
