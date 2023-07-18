'use client'
import {useRouter} from 'next/navigation'
import {useState, useEffect, useTransition} from 'react'
import useSWR from 'swr'
import {type Note} from '~/db/schema/notes'
import {fetcher, sleep} from '~/util'
import {mutateNote} from '../../../eton/actions/actions'
import NoteDialog from '~/components/note/note-dialog'

type NoteDetailProps = {params: {id: string}}

export default function NoteDetailModal({params: {id}}: NoteDetailProps) {
  const router = useRouter()
  const [openModal, setOpenModal] = useState(false)
  const [_, startTransition] = useTransition()

  // the new `use` hook still not ready so temporarily use `swr` if client-side fetching is needed
  const {data: noteData, isLoading} = useSWR<Note>(
    `/eton/actions?id=${id}`,
    fetcher,
  )
  const {title, content} = noteData ?? {title: '', content: ''}
  const newNoteData = {title, content}

  const handleCloseModal = () => {
    startTransition(async () => {
      await mutateNote(id, newNoteData)

      setOpenModal(false)
      // delay routing for close dialog animation
      await sleep(200)
      router.back()
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
      onClose={handleCloseModal}
      isLoading={isLoading}
    />
  )
}
