import EncryptedWorkspace from '~/components/note/encryption/encrypted-workspace'
import {requireAuth} from '~/server-utils'

export default async function EncryptedCollection() {
  const {userInfo} = await requireAuth()
  return (
    <main>
      <EncryptedWorkspace
        ownerId={userInfo.id}
        enrollmentEnabled={
          process.env.NOTE_ENCRYPTION_ENROLLMENT_ENABLED === 'true'
        }
        creationEnabled={
          process.env.NOTE_ENCRYPTION_CREATION_ENABLED === 'true'
        }
      />
    </main>
  )
}
