import {NextIntlClientProvider} from 'next-intl'
import {getMessages} from 'next-intl/server'
import {ViewTransition} from 'react'
import NoteCreateEditor from '~/components/note/note-create'
import NoteTiny from '~/components/note/note-tiny'
import {getListNote} from '~/db/helper/notes'
import {requireAuth} from '~/server-utils'
import type {PropsWithLocale} from '~/types'
import {Link} from '~/i18n/navigation'
import {buttonClass} from '~/components/ui/button'
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

  if (renderNoteList.length === 0) {
    return (
      <NextIntlClientProvider messages={{note: noteMsgs}}>
        <main className="bg-dotgrid h-full p-4">
          <div className="flex justify-end">
            <Link href="/trash" className={buttonClass({variant: 'ghost'})}>
              {noteMsgs.trash.title}
            </Link>
          </div>
          <div className="flex-center mt-40 gap-4">
            <h3
              className="text-ink font-serif opacity-80"
              suppressHydrationWarning
            >
              {genRandom(noteMsgs.editor.emptyPlaceholder)}
            </h3>
            <NoteCreateEditor />
          </div>
        </main>
      </NextIntlClientProvider>
    )
  }

  return (
    <main className="body-h-auto p-4 max-sm:pt-0">
      <NextIntlClientProvider messages={{note: noteMsgs}}>
        <div className="mb-4 flex justify-end gap-2">
          <Link href="/trash" className={buttonClass({variant: 'ghost'})}>
            {noteMsgs.trash.title}
          </Link>
          <NoteCreateEditor />
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(17rem,100%),1fr))] grid-rows-[masonry] gap-4 pb-16">
          {renderNoteList}
        </div>
      </NextIntlClientProvider>
    </main>
  )
}
