import {NextIntlClientProvider} from 'next-intl'
import {getMessages} from 'next-intl/server'
import {ViewTransition} from 'react'
import NoteTiny from '~/components/note/note-tiny'
import {getListNote} from '~/db/helper/notes'
import {requireAuth} from '~/server-utils'
import type {PropsWithLocale} from '~/types'
import {genRandom} from '~/util'

export default async function Notes({params}: PropsWithLocale) {
  const {userInfo} = await requireAuth()
  const notes = await getListNote(userInfo.id)
  const locale = (await params).locale
  const noteMsgs = (await getMessages({locale})).note

  const renderNoteList = notes.map((noteData) => (
    <ViewTransition key={`tiny-note-${noteData.id}`}>
      <NoteTiny data={noteData} />
    </ViewTransition>
  ))

  return (
    <main className={notes.length ? 'body-h-auto' : 'bg-dotgrid flex-1'}>
      <NextIntlClientProvider messages={{note: noteMsgs}}>
        {notes.length === 0 ? (
          <div className="flex-center mt-40">
            <h3
              className="text-ink font-serif opacity-80"
              suppressHydrationWarning
            >
              {genRandom(noteMsgs.editor.emptyPlaceholder)}
            </h3>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(17rem,100%),1fr))] grid-rows-[masonry] gap-4 pb-16">
            {renderNoteList}
          </div>
        )}
      </NextIntlClientProvider>
    </main>
  )
}
