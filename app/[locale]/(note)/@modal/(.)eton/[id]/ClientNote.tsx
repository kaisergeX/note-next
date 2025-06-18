'use client'

import {useRouter} from 'next/navigation'
import {useEffect, useState, useTransition} from 'react'
import NoteDialog from '~/components/note/note-dialog'
import {type Note, type UpdateNote} from '~/db/schema/notes'
import {usePersistStore} from '~/store'
import {isEqualNonNestedObj, sleep} from '~/util'
import {mutateNoteAction} from '../../../eton/actions'

type NoteDetailProps = {data: Note}

export default function ClientNoteModal({data: noteData}: NoteDetailProps) {
  const id = noteData.id
  const router = useRouter()
  const [openModal, setOpenModal] = useState(false)
  const [isPendingTransition, startTransition] = useTransition()
  const [mutateNoteData, setMutateNoteData] = usePersistStore((s) => [
    s.mutateNoteData,
    s.setMutateNoteData,
  ])

  const initNoteData: UpdateNote = {
    title: noteData?.title || '',
    content: noteData?.content || '',
    theme: noteData?.theme,
  }

  const handleCloseModal = async () => {
    setOpenModal(false)
    try {
      await sleep(200)
      router.back()
    } finally {
      setMutateNoteData(undefined)
    }
  }

  const handleSubmit = async () => {
    if (!mutateNoteData || isEqualNonNestedObj(initNoteData, mutateNoteData)) {
      await handleCloseModal()
      return
    }

    startTransition(async function () {
      await mutateNoteAction(id, mutateNoteData)
      await handleCloseModal()
    })
  }

  useEffect(() => {
    // void screen.orientation.lock('landscape') // lock rotate on mobile, not fully supported yet

    setMutateNoteData(noteData)
    setOpenModal(true) // this help open dialog animation can happen
  }, [])

  return (
    <NoteDialog
      open={openModal}
      note={noteData}
      onClose={() => void handleSubmit()}
      loading={isPendingTransition}
      onDeleteSuccess={() => router.back()}
    />
  )
}
