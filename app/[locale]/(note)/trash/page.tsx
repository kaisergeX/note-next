import {getTranslations} from 'next-intl/server'
import TrashList from '~/components/note/trash/trash-list'
import {noteRepository} from '~/db/helper/notes'
import {noteText} from '~/lib/notes/text'
import {requireAuth} from '~/server-utils'

export default async function TrashPage() {
  const {userInfo} = await requireAuth()
  const t = await getTranslations('note.trash')
  const notes = await noteRepository.getTrashNotes(userInfo.id)
  const serverNow = await noteRepository.getServerTime()
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6">
      {notes.length > 0 && (
        <p className="text-ink-muted text-sm">{t('retention')}</p>
      )}
      <TrashList
        items={notes.map((note) => ({
          id: note.id,
          title: noteText(note.title),
          excerpt: noteText(note.content).slice(0, 240),
          deadlineToken: note.deadlineToken!,
        }))}
        serverNow={serverNow}
      />
    </main>
  )
}
