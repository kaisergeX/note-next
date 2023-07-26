'use client'

import {useState, useTransition} from 'react'
import NoteDialog from './note-dialog'
import type {NewNote} from '~/db/schema/notes'
import {createNoteAction} from '~/app/[locale]/(note)/eton/actions'
import {IconPencilPlus} from '@tabler/icons-react'
import {IconSparkles} from '@tabler/icons-react'
import {genRandom} from '~/util'

export default function NoteCreateEditor({authorId}: {authorId: string}) {
  const [_, startTransition] = useTransition()
  const [openModal, setOpenModal] = useState(false)
  const newNoteData: NewNote = {authorId}

  const handleCloseModal = () => {
    if (!newNoteData.title && !newNoteData.content) {
      setOpenModal(false)
      return
    }

    startTransition(async () => {
      await createNoteAction(newNoteData)
      setOpenModal(false)
    })
  }

  return (
    <>
      <div className="mb-4 text-right">
        <button
          className="button-secondary sm-only:button sm-only:button-affix sm-only:button-icon group
            z-20 gap-0 transition-all sm-only:rounded-full sm-only:!p-3 sm:hover:gap-2"
          type="button"
          onClick={() => setOpenModal(true)}
        >
          <IconPencilPlus className="sm:group-hover:hidden" />
          <IconSparkles className="hidden sm:group-hover:block" />
          <span
            className="w-0 overflow-hidden opacity-0 transition-all delay-75 duration-300 group-hover:w-max group-hover:opacity-100 sm-only:hidden"
            suppressHydrationWarning
          >
            {genRandom([
              'New idea',
              'New note',
              'New todos',
              'New inspiration',
            ])}
          </span>
        </button>
      </div>

      <NoteDialog
        open={openModal}
        mutateNote={newNoteData}
        type="create"
        onClose={handleCloseModal}
      />
    </>
  )
}
