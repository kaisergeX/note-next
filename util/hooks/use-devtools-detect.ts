'use client'

import {useCallback, useEffect, useState} from 'react'
import {debugTimingCheck} from '..'
import {useWindowEvent} from './use-window-event'

const DEVTOOLS_DETECT_INTERVAL = 1000

export function useDevtoolsDetect() {
  const [isOpen, setIsOpen] = useState(false)

  const checkOnce = useCallback(() => {
    if (process.env.NODE_ENV !== 'production') return
    setIsOpen(debugTimingCheck(1000))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (process.env.NODE_ENV !== 'production') return

    // initial run
    checkOnce()
    const id = window.setInterval(checkOnce, DEVTOOLS_DETECT_INTERVAL)
    document.addEventListener('visibilitychange', checkOnce)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', checkOnce)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useWindowEvent('resize', checkOnce)

  return isOpen
}
