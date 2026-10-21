'use client'

import {useEffect} from 'react'
import {isAppearanceId, syncBrowserThemeColor} from '~/lib/appearance'
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
      syncBrowserThemeColor()
    }

    applyAppearance()
    media.addEventListener('change', applyAppearance)
    return () => media.removeEventListener('change', applyAppearance)
  }, [appearance, hasHydrated, mode])

  useEffect(() => {
    // Next may restore viewport metadata during client navigation. Reapply the
    // selected palette; unchanged values are not written, avoiding a loop.
    const observer = new MutationObserver(syncBrowserThemeColor)
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['content', 'media'],
    })
    return () => observer.disconnect()
  }, [])

  return children
}
