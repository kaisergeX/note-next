'use client'
import {useEffect} from 'react'

export function useWindowEvent<K extends string = keyof WindowEventMap>(
  type: K,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
) {
  useEffect(() => {
    window.addEventListener(type, listener, options)
    return () => window.removeEventListener(type, listener, options)
  }, [type, listener, options])
}
