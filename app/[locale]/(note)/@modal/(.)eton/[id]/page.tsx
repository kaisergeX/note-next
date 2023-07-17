'use client'
import {useRouter} from 'next/navigation'
import {useState, useEffect, useTransition} from 'react'
import useSWR from 'swr'
import DialogCustom from '~/components/dialog'
import NoteEditor from '~/components/note/note-editor'
import {type Note} from '~/db/schema/notes'
import {fetcher, sleep} from '~/util'
import {mutateNote} from '../../../eton/actions/actions'
import NoteTitleEditor from '~/components/note/note-title'

type NoteDetailProps = {params: {id: string}}

export default function NoteDetailModal({params: {id}}: NoteDetailProps) {
  const router = useRouter()
  const [openModal, setOpenModal] = useState(false)
  const [_, startTransition] = useTransition()

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640

  // the new `use` hook still not ready so temporarily use `swr` if client-side fetching is needed
  const {data: noteData = {title: '', content: ''}, isLoading} = useSWR<Note>(
    `/eton/actions?id=${id}`,
    fetcher,
  )
  const {title, content} = noteData
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
    <DialogCustom
      open={openModal}
      title={
        isMobile ? undefined : (
          <NoteTitleEditor
            title={title}
            onChange={(value) => {
              newNoteData.title = value
            }}
          />
        )
      }
      onClose={() => void handleCloseModal()}
      loading={isLoading}
    >
      <div>
        {isMobile && (
          <NoteTitleEditor
            title={title}
            onChange={(value) => {
              newNoteData.title = value
            }}
          />
        )}
        <NoteEditor
          initialValue={content}
          placeholder="No content"
          onChange={(value) => {
            newNoteData.content = value
          }}
        />
      </div>
    </DialogCustom>
  )
}
