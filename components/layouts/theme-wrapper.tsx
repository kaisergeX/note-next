'use client'
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
      setTheme('dark')
    }
  }, [theme, isDarkSystem, setTheme])

  useEffect(() => {
    // hydrate the presisted store to get state from Storage once
    void usePersistStore.persist.rehydrate()
    withStorageDOMEvents(usePersistStore)
  }, [])

  return (
    <html {...props} className={`${className}${isDarkMode ? ' dark' : ''}`}>
      <body className="relative flex h-[100dvh] flex-col font-inter">
        {children}
      </body>
    </html>
  )
}
