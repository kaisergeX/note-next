'use client'

import {useRouter} from 'next/navigation'
import {useEffect, useState, useTransition} from 'react'
import NoteDialog from '~/components/note/note-dialog'
import type {Note} from '~/db/schema/notes'
import {usePersistStore} from '~/store'
import {isEqualNonNestedObj, sleep} from '~/util'
import {mutateNoteAction} from '../../../eton/actions'

type NoteDetailProps = {noteData: Note}

export default function NoteDetailModal({noteData}: NoteDetailProps) {
  const router = useRouter()
  const [openModal, setOpenModal] = useState(false)
  const [isPendingTransition, startTransition] = useTransition()
  const [mutateNoteData, setMutateNoteData] = usePersistStore((s) => [
    s.mutateNoteData,
    s.setMutateNoteData,
  ])

  const handleCloseModal = async () => {
    setOpenModal(false)
    await sleep(200)
    router.back()
  }

  const handleSubmit = async () => {
    if (
      !mutateNoteData ||
      isEqualNonNestedObj(noteData, mutateNoteData, [
        'createdAt',
        'updatedAt',
        'pendingDeleteAt',
      ])
    ) {
      await handleCloseModal()
      return
    }

    startTransition(async () => {
      await mutateNoteAction(noteData.id, mutateNoteData)
      await handleCloseModal()
    })
  }

  useEffect(() => {
    // void screen.orientation.lock('landscape') // lock rotate on mobile, not fully supported yet

    setMutateNoteData(noteData)
    setOpenModal(true) // this help open dialog animation can happen

    return () => {
      setMutateNoteData(undefined)
    }
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
