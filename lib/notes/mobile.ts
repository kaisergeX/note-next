'use client'

import {useSyncExternalStore} from 'react'

const query = '(width < 40rem)'
export const isMobileNoteView = () => window.matchMedia(query).matches
const subscribe = (callback: () => void) => {
  const media = window.matchMedia(query)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
export const useMobileNoteView = () =>
  useSyncExternalStore(subscribe, isMobileNoteView, () => false)
