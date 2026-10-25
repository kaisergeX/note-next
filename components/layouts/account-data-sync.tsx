'use client'

import {useEffect} from 'react'
import {useSession} from 'next-auth/react'
import {useRouter} from 'next/navigation'
import {
  ACCOUNT_EVENT_KEY,
  clearDeletedAccountBrowserData,
} from '~/lib/account/client-events'
import {usePersistStore} from '~/store'

export default function AccountDataSync() {
  const router = useRouter()
  const {data: session} = useSession()
  const id = session?.user?.id
  const email = session?.user?.email
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== ACCOUNT_EVENT_KEY || !event.newValue || !id) return
      try {
        const value: unknown = JSON.parse(event.newValue)
        if (
          !value ||
          typeof value !== 'object' ||
          !('ownerId' in value) ||
          value.ownerId !== id ||
          !('type' in value)
        )
          return
        if (value.type === 'trash-updated') {
          router.refresh()
          return
        }
        if (value.type !== 'notes-trashed' && value.type !== 'account-deleted')
          return
        usePersistStore.getState().setMutateNoteData(undefined)
        if (value.type === 'account-deleted') {
          if (email) clearDeletedAccountBrowserData(email)
          const locale = document.documentElement.lang === 'vi' ? 'vi' : 'en'
          window.location.replace(`/${locale}/account-deleted`)
        } else {
          window.location.reload()
        }
      } catch {
        /* Ignore malformed cross-tab messages. */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [id, email, router])
  return null
}
