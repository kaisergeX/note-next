'use client'

import {SessionProvider} from 'next-auth/react'
import type {ReactNode} from 'react'
import {SerwistProvider} from '~/app/serwist'

export default function ProviderWrapper({children}: {children: ReactNode}) {
  return (
    <SerwistProvider
      swUrl="/sw.js"
      disable={process.env.NODE_ENV === 'development'}
    >
      <SessionProvider>{children}</SessionProvider>
    </SerwistProvider>
  )
}
