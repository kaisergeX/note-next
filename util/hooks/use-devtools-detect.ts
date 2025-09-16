'use client'

import {useEffect, useState} from 'react'
import {consoleGetterCheck, debugTimingCheck} from '..'
import {useWindowEvent} from './use-window-event'

type UseDevtoolsDetectOptions = {
  /** ms between checks */
  checkInterval?: number
}

export function useDevtoolsDetect({
  checkInterval = 1000,
}: UseDevtoolsDetectOptions = {}) {
  const [isOpen, setIsOpen] = useState(false)

  function checkOnce() {
    if (process.env.NODE_ENV !== 'production') return
    setIsOpen(consoleGetterCheck() || debugTimingCheck())
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (process.env.NODE_ENV !== 'production') return

    // initial run
    checkOnce()

    const id = window.setInterval(checkOnce, Math.max(300, checkInterval))
    document.addEventListener('visibilitychange', checkOnce)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', checkOnce)
    }
  }, [checkInterval])

  useWindowEvent('resize', checkOnce)

  return isOpen
}
