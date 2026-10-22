'use client'

import {useSession} from 'next-auth/react'
import {useEffect, useRef, useSyncExternalStore} from 'react'
import {usePersistStore} from '~/store'

const ACCOUNT_KEY = 'etoN-appearance-session-account'
let confirmedAccount: string | undefined
const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

function publishAccount(account: string | undefined) {
  rememberAccount(account)
  if (confirmedAccount === account) return
  confirmedAccount = account
  listeners.forEach((onChange) => onChange())
}

const getAccount = () => confirmedAccount
const getServerAccount = () => undefined

function readAccount() {
  try {
    return sessionStorage.getItem(ACCOUNT_KEY) || undefined
  } catch {
    return undefined
  }
}

function rememberAccount(account: string | undefined) {
  try {
    if (account) sessionStorage.setItem(ACCOUNT_KEY, account)
    else sessionStorage.removeItem(ACCOUNT_KEY)
  } catch {
    // The current tab can still retain its confirmed identity in memory.
  }
}

/** A failed session fetch is not a confirmed sign-out. Keep the offline queue attached. */
export function useAppearanceAccount() {
  const {data: session, status, update} = useSession()
  const hydrated = usePersistStore((state) => state.hasHydrated)
  const account = useSyncExternalStore(subscribe, getAccount, getServerAccount)
  const refreshSession = useRef(update)
  const lastRecovery = useRef(0)
  const sessionAccount = !session?.error ? session?.user.email : undefined

  useEffect(() => {
    refreshSession.current = update
  }, [update])

  useEffect(() => {
    if (!hydrated) return
    if (sessionAccount || session?.error) {
      publishAccount(sessionAccount)
      return
    }

    let stopped = false
    let running = false
    const controller = new AbortController()
    function retainAccount() {
      if (!stopped && !confirmedAccount) {
        const cached = readAccount()
        if (cached) publishAccount(cached)
      }
    }
    async function verifyAccount() {
      if (stopped || running) return
      if (!navigator.onLine) {
        retainAccount()
        return
      }
      running = true
      try {
        // Unlike getSession(), a failed fetch must not be interpreted as null.
        const response = await fetch('/api/auth/session', {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(10000),
          ]),
        })
        if (!response.ok) throw new Error('Session check unavailable')
        const data: unknown = await response.json()
        // Auth.js returns JSON null for a successfully checked guest session.
        if (data === null) {
          if (!stopped) publishAccount(undefined)
          return
        }
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('Invalid session response')
        }
        const user = 'user' in data ? data.user : undefined
        const confirmed =
          !('error' in data) &&
          user &&
          typeof user === 'object' &&
          'email' in user &&
          typeof user.email === 'string'
            ? user.email
            : undefined
        if (stopped) return
        publishAccount(confirmed)
        // Recover the shared session UI too after Auth.js lost it offline.
        // Throttle recovery if a second network request fails independently.
        if (confirmed && Date.now() - lastRecovery.current > 10000) {
          lastRecovery.current = Date.now()
          void refreshSession.current()
        }
      } catch {
        retainAccount()
      } finally {
        running = false
      }
    }
    const refresh = () => {
      void verifyAccount()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener('online', refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibility)
    const interval = window.setInterval(onVisibility, 60000)
    if (status !== 'loading') refresh()
    else if (!navigator.onLine) retainAccount()
    return () => {
      stopped = true
      controller.abort()
      window.clearInterval(interval)
      window.removeEventListener('online', refresh)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [hydrated, sessionAccount, session?.error, status])

  return account
}
