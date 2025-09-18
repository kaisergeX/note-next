import {unstable_ViewTransition as ViewTransition} from 'react'
import NoteCreateEditor from '~/components/note/note-create'
import NoteTiny from '~/components/note/note-tiny'
import {getListNote} from '~/db/helper/notes'
import {requireAuth} from '~/server-utils'
import {genRandom} from '~/util'

export default async function Notes() {
  const {userInfo} = await requireAuth()
  const notes = await getListNote(userInfo.id)

  const renderNoteList = notes.map((noteData) => (
    <ViewTransition key={`tiny-note-${noteData.id}`}>
      <NoteTiny data={noteData} />
    </ViewTransition>
  ))

  if (renderNoteList.length === 0) {
    return (
      <main className="bg-fancy h-full p-4">
        <div className="flex-center mt-40 gap-4">
          <h3 className="opacity-80">
            {genRandom([
              'Nothing here yet 😶‍🌫️',
              "Let's add New💡",
              "Let's add something inspirational ✨",
              "Let's add a todo 📝",
            ])}
          </h3>
          <NoteCreateEditor authorId={userInfo.id} />
        </div>
      </main>
    )
  }

  return (
    <main className="h-full p-4 max-sm:pt-0">
      <div className="mb-4 text-right">
        <NoteCreateEditor authorId={userInfo.id} />
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(17rem,100%),1fr))] grid-rows-[masonry] gap-4 pb-16">
        {renderNoteList}
      </div>
    </main>
  )
}
