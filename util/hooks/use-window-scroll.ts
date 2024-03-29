'use client'
import {useState, useEffect} from 'react'
import {useWindowEvent} from './use-window-event'

type ScrollPosition = {
  x: number
  y: number
}

function getScrollPosition(): ScrollPosition {
  return typeof window !== 'undefined'
    ? {x: window.scrollX, y: window.scrollY}
    : {x: 0, y: 0}
}

function scrollTo({x, y}: Partial<ScrollPosition>) {
  if (typeof window !== 'undefined') {
    const scrollOptions: ScrollToOptions = {behavior: 'smooth'}

    if (typeof x === 'number') {
      scrollOptions.left = x
    }

    if (typeof y === 'number') {
      scrollOptions.top = y
    }

    window.scrollTo(scrollOptions)
  }
}

function getViewInfo(): {viewY: number; maxViewY: number} {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {viewY: 0, maxViewY: 0}
  }

  return {
    viewY: window.innerHeight + window.scrollY,
    maxViewY: document.documentElement.scrollHeight,
  }
}

export function useWindowScroll() {
  const [position, setPosition] = useState<ScrollPosition>({x: 0, y: 0})

  useWindowEvent('scroll', () => setPosition(getScrollPosition()))
  useWindowEvent('resize', () => setPosition(getScrollPosition()))

  useEffect(() => {
    setPosition(getScrollPosition())
  }, [])

  return [position, scrollTo, getViewInfo()] as const
}
