'use client'

import {useCallback, useRef, useState, useEffect} from 'react'

function getFullscreenElement(): HTMLElement | null {
  return typeof window.document !== 'undefined'
    ? (window.document.fullscreenElement as HTMLElement)
    : null
}

async function exitFullscreen() {
  return typeof window.document.exitFullscreen() !== 'undefined'
    ? window.document.exitFullscreen()
    : null
}

async function enterFullScreen(element?: HTMLElement) {
  return element?.requestFullscreen?.()
}

function addEvents(
  element: HTMLElement,
  {
    onFullScreen,
    onError,
  }: {onFullScreen: (event: Event) => void; onError: (event: Event) => void},
) {
  element.addEventListener('fullscreenchange', onFullScreen)
  element.addEventListener('fullscreenerror', onError)

  return () => {
    element.removeEventListener('fullscreenchange', onFullScreen)
    element.removeEventListener('fullscreenerror', onError)
  }
}

/**
 * This hook allows to view fullscreen using the {@link https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API Fullscreen API}.
 *
 * By default hook will target `document.documentElement`, same as press `F11` in browser.
 * ___
 * ⚠️ Mobile devices are NOT supported.
 * ___
 * @returns (optional) `ref` function that can be passed to an element to act as root
 * @example with `ref`
 * ```tsx
 * 'use client'
 *
 * const {ref, toggleFullscreen} = useFullscreen();
 *
 * <Image
 *  ref={ref}
 *  className="rounded-full ring-1 ring-gray-900/5"
 *  src={userInfo.image}
 *  alt="your-profile-avatar"
 *  width={80}
 *  height={80}
 *  onClick={() => void toggleFullscreen()}
 * />
 * ```
 */
export function useFullscreen<T extends HTMLElement>() {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [error, setError] = useState(false)

  const elementRef = useRef<T>(undefined)

  const handleFullscreenChange = useCallback(
    (event: Event) => {
      setIsFullscreen(event.target === getFullscreenElement())
    },
    [setIsFullscreen],
  )

  const handleFullscreenError = useCallback(() => {
    console.error('Could not switch to fullscreen mode')
    setError(true)
    setIsFullscreen(false)
  }, [setIsFullscreen])

  const toggleFullscreen = useCallback(async () => {
    if (isMobile) {
      return
    }

    if (!getFullscreenElement()) {
      return await enterFullScreen(elementRef.current)
    }

    await exitFullscreen()
  }, [])

  const ref = useCallback((element: T | null) => {
    if (element === null) {
      elementRef.current = window.document.documentElement as T
    } else {
      elementRef.current = element
    }
  }, [])

  useEffect(() => {
    if (isMobile) {
      setError(true)
      return undefined
    }

    if (elementRef.current) {
      return addEvents(elementRef.current, {
        onFullScreen: handleFullscreenChange,
        onError: handleFullscreenError,
      })
    }

    if (window.document) {
      elementRef.current = window.document.documentElement as T

      return addEvents(elementRef.current, {
        onFullScreen: handleFullscreenChange,
        onError: handleFullscreenError,
      })
    }

    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {ref, toggleFullscreen, isFullscreen, error} as const
}
