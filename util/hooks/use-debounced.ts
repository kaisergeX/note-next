/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import {useEffect, useState, useRef, useCallback} from 'react'

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

  const cancelUpdate = useCallback(() => {
    if (typeof window === 'undefined' || !timeoutRef.current) {
      return
    }

    window.clearTimeout(timeoutRef.current)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !mountedRef.current) {
      return
    }

    if (!cooldownRef.current && firstUpdate) {
      cooldownRef.current = true
      setValue(value)
      return
    }

    cancelUpdate()
    timeoutRef.current = window.setTimeout(() => {
      cooldownRef.current = false
      setValue(value)
    }, wait)
  }, [value, firstUpdate, wait])

  useEffect(() => {
    mountedRef.current = true
    return cancelUpdate
  }, [])

  return [deboucedValue, cancelUpdate] as const
}
