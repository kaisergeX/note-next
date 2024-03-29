'use client'
import {useRouter} from 'next/navigation'
import {useState, useEffect, useTransition} from 'react'
import useSWR from 'swr'
import {type Note, type UpdateNote} from '~/db/schema/notes'
import {fetcher, isEqualNonNestedObj, sleep} from '~/util'
import NoteDialog from '~/components/note/note-dialog'
import {mutateNoteAction} from '../../../eton/actions'
import type {ServerError} from '~/types'
import {usePersistStore} from '~/store'

type NoteDetailProps = {params: {id: string}}

export default function NoteDetailModal({params: {id}}: NoteDetailProps) {
  const router = useRouter()
  const [openModal, setOpenModal] = useState(false)
  const [_, startTransition] = useTransition()
  const {mutateNoteData, setMutateNoteData} = usePersistStore()

  // the new `use` hook still not ready so temporarily use `swr` if client-side fetching is needed
  const {
    data: noteData,
    isLoading,
    error,
  } = useSWR<Note, ServerError>(`/api/note/${id}`, fetcher, {
    onSuccess: (data) =>
      setMutateNoteData({
        title: data?.title || '',
        content: data?.content || '',
        theme: data?.theme,
      }),
  })

  if (error) {
    throw error
  }

  const initNoteData: UpdateNote = {
    title: noteData?.title || '',
    content: noteData?.content || '',
    theme: noteData?.theme,
  }

  const handleCloseModal = async () => {
    setOpenModal(false)
    setMutateNoteData(undefined)
    await sleep(200)
    router.back()
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

    setOpenModal(true) // this help open dialog animation can happen
  }, [])

  return (
    <NoteDialog
      open={openModal}
      note={noteData}
      onClose={() => void handleSubmit()}
      loading={isLoading}
      onDeleteSuccess={() => router.back()}
    />
  )
}
