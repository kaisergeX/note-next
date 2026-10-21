'use client'

import {useEffect} from 'react'
import {useRouter} from 'next/navigation'
import type {Route} from 'next'

// Fragments are only available in the browser; keep old appearance bookmarks.
export default function LegacyUserPage() {
  const router = useRouter()
  useEffect(() => {
    const locale = document.documentElement.lang
    const section =
      window.location.hash === '#appearance' ? 'appearance' : 'account'
    router.replace(`/${locale}/settings/${section}` as Route)
  }, [router])
  return null
}
