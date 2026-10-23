import {notFound} from 'next/navigation'
import TrashPreview from '~/components/note/trash/trash-preview'
import {noteRepository} from '~/db/helper/notes'
import {requireAuth} from '~/server-utils'

export default async function TrashNotePage({
  params,
}: PageProps<'/[locale]/trash/[id]'>) {
  const {userInfo} = await requireAuth()
  const note = await noteRepository.getTrashNote(userInfo.id, (await params).id)
  if (!note) notFound()
  const serverNow = await noteRepository.getServerTime()
  return (
    <main className="container mx-auto max-w-4xl p-4 py-8">
      <TrashPreview note={note} serverNow={serverNow} />
    </main>
  )
}
