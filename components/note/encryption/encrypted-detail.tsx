'use client'

import {Dialog} from '@kaiverse/k/ui'
import {useTranslations} from 'next-intl'
import {useRouter} from '~/i18n/navigation'
import EncryptedWorkspace from './encrypted-workspace'

export default function EncryptedDetail({
  ownerId,
  noteId,
  modal = false,
  readOnly = false,
  creationEnabled = false,
  onClose,
}: {
  ownerId: string
  noteId: string
  modal?: boolean
  readOnly?: boolean
  creationEnabled?: boolean
  onClose?: () => void
}) {
  const router = useRouter()
  const t = useTranslations('note.encryption')
  const close =
    onClose ?? (() => (modal ? router.back() : router.replace('/eton')))
  const workspace = (
    <EncryptedWorkspace
      ownerId={ownerId}
      initial={{noteId, readOnly}}
      creationEnabled={creationEnabled}
      onClose={close}
    />
  )
  if (!modal) return workspace
  return (
    <Dialog
      open
      preventClose
      aria-label={t('heading')}
      className="bg-paper-raised text-ink shadow-sheet backdrop:bg-paper/50 m-auto max-h-dvh w-full max-w-3xl overflow-y-auto rounded-lg backdrop:backdrop-blur"
    >
      {workspace}
    </Dialog>
  )
}
