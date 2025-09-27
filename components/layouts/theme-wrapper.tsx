'use client'
import {classNames} from '@kaiverse/k/utils'
import {type HtmlHTMLAttributes, type PropsWithChildren, useEffect} from 'react'
import {usePersistStore, withStorageDOMEvents} from '~/store'

export default function ThemeWrapper({
  className = '',
  children,
  ...props
}: PropsWithChildren<HtmlHTMLAttributes<HTMLElement>>) {
  const {theme, setTheme} = usePersistStore()
  const isDarkMode = theme === 'dark'
  const isDarkSystem =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches

  useEffect(() => {
    if (!theme && isDarkSystem && setTheme) {
      // If no theme is set, and system is dark.
      setTheme('dark')
    }
  }, [theme, isDarkSystem, setTheme])

  useEffect(() => {
    // hydrate the presisted store to get state from Storage once
    void usePersistStore.persist.rehydrate()
    withStorageDOMEvents(usePersistStore)
  }, [])

  return (
    <html
      {...props}
      className={classNames(className, isDarkMode ? 'dark' : '')}
    >
      {/* 
        Note that dv* will adapts with viewport size (which changes the actual size of element),
        so we should use with transition for better UX to avoid instant size scaling.
        eg: scrolling on mobile browsers will hide/show the address bar, which will change the viewport height.
        ref: https://web.dev/viewport-units/
      */}
      <body className="font-inter relative flex min-h-dvh flex-col transition-[height] [scrollbar-gutter:stable] has-[.body-dvh]:h-dvh">
        {children}
      </body>
    </html>
  )
}
