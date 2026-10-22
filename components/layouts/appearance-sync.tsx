'use client'

import {useSession} from 'next-auth/react'
import {useEffect} from 'react'
import {
  isAppearancePreference,
  type AppearancePreference,
} from '~/lib/appearance'
import {
  createAppearanceSync,
  isAppearanceCache,
  type AppearanceCache,
} from '~/lib/appearance-sync'
import {usePersistStore} from '~/store'

export default function AppearanceSync() {
  const {data: session, status} = useSession()
  const hydrated = usePersistStore((state) => state.hasHydrated)
  const account =
    status === 'authenticated' && !session?.error
      ? session?.user.email
      : undefined

  useEffect(() => {
    // Even transient setState calls run the persist middleware. Wait until
    // rehydration so defaults cannot overwrite the saved browser preference.
    if (!hydrated) return
    if (!account) {
      usePersistStore.setState({appearanceSyncStatus: 'local'})
      return
    }
    const key = `etoN-appearance-account:${account}`
    let memory: AppearanceCache | null = null
    let applying = false
    const controller = new AbortController()
    const current = () => {
      const {appearance, mode} = usePersistStore.getState()
      return {appearance, mode}
    }
    async function request(
      method: 'GET' | 'PUT',
      value?: AppearancePreference,
      initialize = false,
    ) {
      const response = await fetch(
        `/api/user/appearance?${new URLSearchParams({account: account!})}`,
        {
          method,
          cache: 'no-store',
          credentials: 'same-origin',
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(10000),
          ]),
          ...(method === 'PUT'
            ? {
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({...value, account, initialize}),
              }
            : {}),
        },
      )
      if (!response.ok) throw new Error('Appearance sync failed')
      const data: unknown = await response.json()
      if (
        !data ||
        typeof data !== 'object' ||
        !('account' in data) ||
        data.account !== account ||
        !('preference' in data) ||
        (data.preference !== null && !isAppearancePreference(data.preference))
      ) {
        throw new Error('Invalid appearance response')
      }
      return data.preference as AppearancePreference | null
    }
    const sync = createAppearanceSync({
      current,
      apply(value) {
        applying = true
        usePersistStore.setState({
          appearance: value.appearance,
          mode: value.mode,
        })
        applying = false
      },
      readCache() {
        try {
          const raw = localStorage.getItem(key)
          const value: unknown = raw ? JSON.parse(raw) : null
          if (isAppearanceCache(value)) memory = value
        } catch {
          /* In-memory sync still works when browser storage is unavailable. */
        }
        return memory
      },
      writeCache(value) {
        memory = value
        try {
          localStorage.setItem(key, JSON.stringify(value))
        } catch {
          /* Keep the in-memory queue. */
        }
      },
      readRemote: () => request('GET'),
      async writeRemote(value, initialize) {
        const saved = await request('PUT', value, initialize)
        if (!saved) throw new Error('Missing saved appearance')
        return saved
      },
      status: (appearanceSyncStatus) =>
        usePersistStore.setState({appearanceSyncStatus}),
      online: () => navigator.onLine,
      newId: () => crypto.randomUUID(),
    })
    const unsubscribe = usePersistStore.subscribe((state, previous) => {
      if (
        !applying &&
        state.appearanceChangeId !== previous.appearanceChangeId
      ) {
        sync.change(current())
      }
    })
    const refresh = () => {
      void sync.sync()
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) refresh()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    const onOffline = () =>
      usePersistStore.setState({appearanceSyncStatus: 'offline'})
    window.addEventListener('online', refresh)
    window.addEventListener('offline', onOffline)
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisibility)
    const interval = window.setInterval(onVisibility, 60000)
    refresh()
    return () => {
      sync.stop()
      controller.abort()
      unsubscribe()
      window.clearInterval(interval)
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [account, hydrated])

  return null
}
