'use client'

import {IconPencilPlus, IconSparkles} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import {useState} from 'react'
import Button from '~/components/ui/button'
import NoteDialog from './note-dialog'
import {useNoteSession} from './use-note-session'

export default function NoteCreateEditor({
  creationLabel,
}: {
  creationLabel: string
}) {
  const t = useTranslations('note')
  const [openModal, setOpenModal] = useState(false)
  const session = useNoteSession(undefined, openModal)
  const handleCloseModal = () =>
    void session.saveAndLeave(() => setOpenModal(false))

  return (
    <>
      <Button
        variant="secondary"
        className="group btn-light-sweep w-auto gap-0 p-2 transition-all duration-300 max-sm:fixed max-sm:right-4 max-sm:bottom-[calc(1rem+env(safe-area-inset-bottom))] max-sm:z-10 max-sm:rounded-full sm:hover:gap-2"
        aria-label={creationLabel}
        onClick={() => setOpenModal(true)}
      >
        <IconPencilPlus className="sm:group-hover:hidden" />
        <IconSparkles className="hidden sm:group-hover:block" />
        <span
          // switch to width: calc-size(auto, size) instead of max-width trick for auto width transition when it widely supported
          className="max-w-0 overflow-clip whitespace-nowrap opacity-0 transition-all duration-300 ease-in-out group-hover:max-w-36 group-hover:opacity-100 max-sm:hidden"
        >
          {creationLabel}
        </span>
      </Button>

      {session.ready && (
        <NoteDialog
          open={openModal}
          type="create"
          error={session.error ? t('status.saveFailed') : undefined}
          loading={session.pending}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}
