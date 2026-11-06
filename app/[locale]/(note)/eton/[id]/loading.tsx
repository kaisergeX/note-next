import {getTranslations} from 'next-intl/server'
import {NoteEditorLoading} from '~/components/note/note-loading'

export default async function Loading() {
  const t = await getTranslations('note.loading')
  return <NoteEditorLoading label={t('editor')} />
}
