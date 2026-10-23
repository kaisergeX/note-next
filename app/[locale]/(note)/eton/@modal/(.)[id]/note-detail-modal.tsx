/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import {useTranslations} from 'next-intl'
import {useRouter} from '~/i18n/navigation'
import {performNoteMutation} from '~/lib/notes/client-mutation'
import {noteMutationSucceeded} from '~/lib/notes/lifecycle'
import {pickNoteContent} from '~/lib/notes/validation'
import {useEffect, useLayoutEffect, useState, useTransition} from 'react'
import NoteDialog from '~/components/note/note-dialog'
import type {Note} from '~/db/schema/notes'
import {usePersistStore} from '~/store'
import {isEqualNonNestedObj, sleep} from '~/util'
import {mutateNoteAction} from '../../actions'

type NoteDetailProps = {noteData: Note}

export default function NoteDetailModal({noteData}: NoteDetailProps) {
  const t = useTranslations('note')
  const router = useRouter()
  const [saveError, setSaveError] = useState(false)
  const [openModal, setOpenModal] = useState(false)
  const [isPendingTransition, startTransition] = useTransition()
  const {mutateNoteData, setMutateNoteData} = usePersistStore((s) => ({
    mutateNoteData: s.mutateNoteData,
    setMutateNoteData: s.setMutateNoteData,
  }))

  const handleCloseModal = async () => {
    setOpenModal(false)
    await sleep(200)
    window.history.length > 1 ? router.back() : router.push('/eton')
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
        setSaveError(false)
        const input = pickNoteContent(mutateNoteData)
        const result = await performNoteMutation(() =>
          mutateNoteAction(noteData.id, input),
        )
        if (!noteMutationSucceeded(result)) {
          setSaveError(true)
          return
        }
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
      error={saveError ? t('status.saveFailed') : undefined}
      onClose={handleSubmit}
      loading={isPendingTransition}
      onDeleteSuccess={handleCloseModal}
    />
  )
}
