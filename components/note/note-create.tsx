'use client'

import {IconPencilPlus, IconSparkles} from '@tabler/icons-react'
import {useMessages} from 'next-intl'
import {useState, useTransition} from 'react'
import {createNoteAction} from '~/app/[locale]/(note)/eton/actions'
import {usePersistStore} from '~/store'
import {useRandomString} from '~/util/hooks'
import NoteDialog from './note-dialog'

export default function NoteCreateEditor({authorId}: {authorId: string}) {
  const [isTransitionPending, startTransition] = useTransition()
  const [openModal, setOpenModal] = useState(false)
  const {mutateNoteData, setMutateNoteData} = usePersistStore((state) => ({
    mutateNoteData: state.mutateNoteData,
    setMutateNoteData: state.setMutateNoteData,
  }))
  const messages = useMessages()
  const creationBtnMsg = useRandomString(messages.note.creation)

  const handleCloseModal = () => {
    if (!mutateNoteData || (!mutateNoteData.title && !mutateNoteData.content)) {
      setOpenModal(false)
      setMutateNoteData(undefined)
      return
    }

    startTransition(async () => {
      await createNoteAction({...mutateNoteData, authorId})
      setOpenModal(false)
      setMutateNoteData(undefined)
    })
  }

  return (
    <>
      <button
        className="button-secondary btn-light-sweep max-sm:button max-sm:button-affix max-sm:button-icon group w-auto gap-0 transition-all duration-300 max-sm:z-10 max-sm:rounded-full max-sm:!p-3 sm:hover:gap-2"
        type="button"
        onClick={() => setOpenModal(true)}
      >
        <IconPencilPlus className="sm:group-hover:hidden" />
        <IconSparkles className="hidden sm:group-hover:block" />
        <span
          // switch to width: calc-size(auto, size) instead of max-width trick for auto width transition when it widely supported
          className="max-w-0 overflow-clip whitespace-nowrap opacity-0 transition-all duration-300 ease-in-out group-hover:max-w-36 group-hover:opacity-100 max-sm:hidden"
          suppressHydrationWarning
        >
          {creationBtnMsg}
        </span>
      </button>

      <NoteDialog
        open={openModal}
        type="create"
        loading={isTransitionPending}
        onClose={handleCloseModal}
      />
    </>
  )
}
