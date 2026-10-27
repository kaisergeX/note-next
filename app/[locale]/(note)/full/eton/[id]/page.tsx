import {notFound} from 'next/navigation'
import {getNote} from '~/db/helper/notes'
import {requireAuth} from '~/server-utils'
import NoteDetail from '../../../eton/[id]/note-detail'

export default async function FullNotePage({
  params,
}: PageProps<'/[locale]/full/eton/[id]'>) {
  const {id} = await params
  const {userInfo} = await requireAuth()
  const note = await getNote(userInfo.id, id)
  if (!note) notFound()
  return <NoteDetail noteData={note} />
}
