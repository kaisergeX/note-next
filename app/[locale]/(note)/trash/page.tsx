import {getTranslations} from 'next-intl/server'
import {Link} from '~/i18n/navigation'
import {buttonClass} from '~/components/ui/button'
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
    <main className="container mx-auto max-w-4xl space-y-6 p-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{t('title')}</h1>
          <p className="text-ink-muted mt-2 text-sm">{t('retention')}</p>
        </div>
        <Link className={buttonClass({variant: 'ghost'})} href="/eton">
          {t('back')}
        </Link>
      </header>
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
