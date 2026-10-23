import {NextIntlClientProvider} from 'next-intl'
import {getMessages} from 'next-intl/server'
import type {ReactNode} from 'react'

export default async function TrashLayout({children}: {children: ReactNode}) {
  return (
    <NextIntlClientProvider messages={{note: (await getMessages()).note}}>
      {children}
    </NextIntlClientProvider>
  )
}
