import {getTranslations} from 'next-intl/server'
import {NoteCollectionLoading} from '~/components/note/note-loading'

export default async function Loading() {
  const t = await getTranslations('note.recovery')
  return (
    <div className="w-full p-4 lg:p-6">
      <NoteCollectionLoading label={t('loadingWork')} />
    </div>
  )
}
