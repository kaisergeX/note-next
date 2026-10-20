'use client'

import {useEffect} from 'react'
import {isAppearanceId} from '~/lib/appearance'
import {usePersistStore, withStorageDOMEvents} from '~/store'

export default function ThemeWrapper({children}: React.PropsWithChildren) {
  const {mode, appearance, hasHydrated} = usePersistStore()

  useEffect(() => {
    void usePersistStore.persist.rehydrate()
    return withStorageDOMEvents(usePersistStore)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyAppearance = () => {
      if (!hasHydrated) return

      const root = document.documentElement
      root.dataset.appearance = isAppearanceId(appearance)
        ? appearance
        : 'paper-ink'
      root.classList.toggle(
        'dark',
        mode === 'dark' || (mode === 'system' && media.matches),
      )
    }

    applyAppearance()
    media.addEventListener('change', applyAppearance)
    return () => media.removeEventListener('change', applyAppearance)
  }, [appearance, hasHydrated, mode])

  return children
}
