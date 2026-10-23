'use client'

import {useEffect, useState, useSyncExternalStore} from 'react'
import {useRouter} from '~/i18n/navigation'

const subscribeOnline = (notify: () => void) => {
  window.addEventListener('online', notify)
  window.addEventListener('offline', notify)
  return () => {
    window.removeEventListener('online', notify)
    window.removeEventListener('offline', notify)
  }
}

export function useTrashRefresh(serverNow: number, deadlines: string[]) {
  const router = useRouter()
  const [observedNow, setObservedNow] = useState(serverNow)
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  )
  const deadlineKey = deadlines.join(',')
  useEffect(() => {
    const started = performance.now()
    const synchronize = () => {
      setObservedNow(serverNow + performance.now() - started)
      if (navigator.onLine) router.refresh()
    }
    const visible = () => {
      if (document.visibilityState === 'visible') synchronize()
    }
    let timer: number | undefined
    const schedule = () => {
      const now = serverNow + performance.now() - started
      const nearest = Math.min(
        ...deadlineKey
          .split(',')
          .filter(Boolean)
          .map(Date.parse)
          .filter((deadline) => deadline > now),
      )
      if (Number.isFinite(nearest)) {
        timer = window.setTimeout(
          () => {
            synchronize()
            schedule()
          },
          Math.min(Math.max(0, nearest - now) + 25, 2_147_483_647),
        )
      }
    }
    schedule()
    window.addEventListener('focus', synchronize)
    window.addEventListener('online', synchronize)
    document.addEventListener('visibilitychange', visible)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', synchronize)
      window.removeEventListener('online', synchronize)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [serverNow, deadlineKey, router])
  return {now: Math.max(serverNow, observedNow), online}
}
