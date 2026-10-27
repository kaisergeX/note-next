import {requireAuth} from '~/server-utils'
import NoteRecoveryPage from '~/components/note/note-recovery-page'

export default async function RecoverNotePage({
  params,
}: PageProps<'/[locale]/full/eton/recover/[draftId]'>) {
  const {userInfo} = await requireAuth()
  const {draftId} = await params
  return <NoteRecoveryPage ownerId={userInfo.id} draftId={draftId} />
}
