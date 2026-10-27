import RecoveryDrafts from '~/components/note/recovery-drafts'
import {requireAuth} from '~/server-utils'

export default async function NoteDraftsPage() {
  const {userInfo} = await requireAuth()
  return (
    <main className="w-full">
      <RecoveryDrafts ownerId={userInfo.id} />
    </main>
  )
}
