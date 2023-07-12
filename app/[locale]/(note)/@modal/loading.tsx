'use client'
import {useRouter} from 'next/navigation'
import DialogCustom from '~/components/dialog'

export default function NoteModalLoading() {
  const router = useRouter()

  return <DialogCustom open onClose={() => router.back()} loading />
}
