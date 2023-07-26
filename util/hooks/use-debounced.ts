'use client'

import {useEffect, useState, useRef} from 'react'

/**
 *
 * @param value value to debounce
 * @param wait debounce time in ms
 * @param firstUpdate immediately update value on first call
 *
 * @returns `cancelUpdate` cancel current pending update
 */
export function useDebounced<T = unknown>(
  value: T,
  wait: number,
  firstUpdate?: boolean,
) {
  const [deboucedValue, setValue] = useState(value)
  const mountedRef = useRef(false)
  const timeoutRef = useRef<number | null>(null)
  const cooldownRef = useRef(false)

  const cancelUpdate = () => {
    if (typeof window === 'undefined' || !timeoutRef.current) {
      return
    }

    window.clearTimeout(timeoutRef.current)
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (mountedRef.current) {
      if (!cooldownRef.current && firstUpdate) {
        cooldownRef.current = true
        setValue(value)
      }

      cancelUpdate()
      timeoutRef.current = window.setTimeout(() => {
        cooldownRef.current = false
        setValue(value)
      }, wait)
    }
  }, [value, firstUpdate, wait])

  useEffect(() => {
    mountedRef.current = true
    return cancelUpdate
  }, [])

  return [deboucedValue, cancelUpdate] as const
}
