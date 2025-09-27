'use client'

import {useRouter} from 'next/navigation'
import {useEffect, useLayoutEffect, useState, useTransition} from 'react'
import NoteDialog from '~/components/note/note-dialog'
import type {Note} from '~/db/schema/notes'
import {usePersistStore} from '~/store'
import {isEqualNonNestedObj, sleep} from '~/util'
import {mutateNoteAction} from '../../actions'

type NoteDetailProps = {noteData: Note}

export default function NoteDetailModal({noteData}: NoteDetailProps) {
  const router = useRouter()
  const [openModal, setOpenModal] = useState(false)
  const [isPendingTransition, startTransition] = useTransition()
  const {mutateNoteData, setMutateNoteData} = usePersistStore((s) => ({
    mutateNoteData: s.mutateNoteData,
    setMutateNoteData: s.setMutateNoteData,
  }))

  const handleCloseModal = async () => {
    setOpenModal(false)
    await sleep(200)
    window.history.length > 1 ? router.back() : router.push('/')
  }

  const handleSubmit = () =>
    startTransition(async () => {
      if (
        mutateNoteData &&
        !isEqualNonNestedObj(noteData, mutateNoteData, [
          'createdAt',
          'updatedAt',
          'pendingDeleteAt',
        ])
      ) {
        await mutateNoteAction(noteData.id, mutateNoteData)
      }

      await handleCloseModal()
    })

  useEffect(() => {
    startTransition(() => setOpenModal(true))

    return () => {
      setMutateNoteData(undefined)
    }
  }, [])

  useLayoutEffect(() => {
    // void screen.orientation.lock('landscape') // lock rotate on mobile, not fully supported yet

    setMutateNoteData(noteData)
  }, [])

  return (
    <NoteDialog
      open={openModal}
      onClose={handleSubmit}
      loading={isPendingTransition}
      onDeleteSuccess={handleCloseModal}
    />
  )
}
