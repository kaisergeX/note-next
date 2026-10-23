import {redirect} from 'next/navigation'

export default async function NoteDetailFullPage({
  params,
}: PageProps<'/[locale]/full/eton/[id]'>) {
  const {id: noteId, locale} = await params
  redirect(`/${locale}/eton/${noteId}`) // this should render full page view instead of modal view
}
