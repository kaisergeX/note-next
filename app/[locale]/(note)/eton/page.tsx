'use client'

import {usePathname, redirect} from 'next/navigation'

export default function Notes() {
  const pathname = usePathname()
  redirect(pathname + '/about')
}
