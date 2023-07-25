'use client'
import {useRouter} from 'next/navigation'
import {useState, useEffect, useTransition} from 'react'
import useSWR from 'swr'
import {type Note, type UpdateNote} from '~/db/schema/notes'
import {fetcher, sleep} from '~/util'
import NoteDialog from '~/components/note/note-dialog'
import {mutateNote} from '../../../eton/actions'
import type {ServerError} from '~/types'

type NoteDetailProps = {params: {id: string}}

export default function NoteDetailModal({params: {id}}: NoteDetailProps) {
  const router = useRouter()
  const [openModal, setOpenModal] = useState(false)
  const [_, startTransition] = useTransition()

  // the new `use` hook still not ready so temporarily use `swr` if client-side fetching is needed
  const {
    data: noteData,
    isLoading,
    error,
  } = useSWR<Note, ServerError>(`/api/note/${id}`, fetcher)

  if (error) {
    throw error
  }

  const initNoteData: UpdateNote = {
    title: noteData?.title || '',
    content: noteData?.content || '',
  }
  const newNoteData: UpdateNote = structuredClone(initNoteData)

  const handleCloseModal = async () => {
    setOpenModal(false)
    await sleep(200)
    router.back()
  }

  const handleSubmit = async () => {
    // As long as the ORDER of the properties is the same, it fine to deep compare obj like this
    if (JSON.stringify(initNoteData) === JSON.stringify(newNoteData)) {
      await handleCloseModal()
      return
    }

    startTransition(async function () {
      await mutateNote(id, newNoteData)
      await handleCloseModal()
    })
  }

  useEffect(() => {
    // void screen.orientation.lock('landscape') // lock rotate on mobile, not fully supported yet

    setOpenModal(true) // this help open dialog animation can happen
  }, [])

  return (
    <NoteDialog
      open={openModal}
      note={noteData}
      mutateNote={newNoteData}
      onClose={() => void handleSubmit()}
      isLoading={isLoading}
    />
  )
}
