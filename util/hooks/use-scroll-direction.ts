import {useRef, useState} from 'react'
import {useWindowEvent} from './use-window-event'

type UseScrollDirectionReturnType = 'up' | 'down' | 'none'

type UseScrollDirectionOptions = {
  /**
   * Initial scroll direction
   *
   * @default 'none' // no movement yet
   */
  defaultDirection?: UseScrollDirectionReturnType
  /**
   * Minimum scroll distance to consider in pixels
   *
   * @default 5 (px)
   */
  threshold?: number
  onDirectionChange?: (direction: UseScrollDirectionReturnType) => void
  /**
   * Optional Y position to stop tracking (e.g. bottom of an element)
   * If provided, the hook will stop tracking scroll direction when the scroll position
   * goes beyond this value.
   *
   * @default undefined
   */
  stopTrackingY?: number
}

export const useScrollDirection = ({
  defaultDirection = 'none',
  threshold = 5,
  stopTrackingY,
  onDirectionChange,
}: UseScrollDirectionOptions = {}): UseScrollDirectionReturnType => {
  const lastScrollY = useRef(0)
  const [scrollDir, setScrollDir] =
    useState<UseScrollDirectionReturnType>(defaultDirection)

  useWindowEvent('scroll', () => {
    const currentScrollY = window.scrollY || document.documentElement.scrollTop
    if (stopTrackingY !== undefined && currentScrollY > stopTrackingY) {
      // Stop tracking if we've scrolled beyond stopY
      return
    }

    if (Math.abs(currentScrollY - lastScrollY.current) < threshold) {
      // Ignore small scroll movements
      return
    }

    const direction = currentScrollY > lastScrollY.current ? 'down' : 'up'
    if (direction !== scrollDir) {
      setScrollDir(direction)
      onDirectionChange?.(direction)
    }

    lastScrollY.current = currentScrollY
  })

  return scrollDir
}
