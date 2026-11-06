import {getTranslations} from 'next-intl/server'
import {NoteCollectionLoading} from '~/components/note/note-loading'

export default async function Loading() {
  const t = await getTranslations('note.loading')
  return <NoteCollectionLoading label={t('collection')} />
}
