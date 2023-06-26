import {type ReactNode} from 'react'
import {Inter} from 'next/font/google'
import {useLocale} from 'next-intl'
import {notFound} from 'next/navigation'
import '../globals.css'
import ProviderWrapper from '~/components/provider-wrapper'

export const metadata = {
  title: 'etoN - Kaiverse',
  description: 'A minimalistic note-taking app for everyone.',
}

const inter = Inter({subsets: ['latin']})

type Props = {
  children: ReactNode
  params: {locale: string}
}

export default function LocaleLayout({children, params}: Props) {
  const locale = useLocale()

  // Show a 404 error if the user requests an unknown locale
  if (params.locale !== locale) {
    notFound()
  }

  return (
    <html lang={locale}>
      <body className={`${inter.className} h-[100dvh]`}>
        <ProviderWrapper>{children}</ProviderWrapper>
      </body>
    </html>
  )
}
