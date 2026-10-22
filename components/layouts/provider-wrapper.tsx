'use client'

import {SessionProvider} from 'next-auth/react'
import type {ReactNode} from 'react'
import {SerwistProvider} from '~/app/serwist'
import AppearanceSync from './appearance-sync'

export default function ProviderWrapper({children}: {children: ReactNode}) {
  return (
    <SerwistProvider
      swUrl="/sw.js"
      disable={process.env.NODE_ENV === 'development'}
    >
      <SessionProvider>
        <AppearanceSync />
        {children}
      </SessionProvider>
    </SerwistProvider>
  )
}
