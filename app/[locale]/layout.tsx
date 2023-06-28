import {type ReactNode} from 'react'
import {Inter} from 'next/font/google'
import {useLocale, useTranslations} from 'next-intl'
import {notFound} from 'next/navigation'
import ProviderWrapper from '~/components/layouts/provider-wrapper'
import Navbar from '~/components/layouts/navbar'
import ThemeWrapper from '~/components/layouts/theme-wrapper'
import '../globals.css'

export const metadata = {
  title: process.env.SERVICE_NAME ?? '',
  description: 'A minimalistic note-taking app for everyone.',
}

const inter = Inter({subsets: ['latin'], variable: '--font-inter'})

type Props = {
  children: ReactNode
  params: {locale: string}
}

export default function LocaleLayout({children, params}: Props) {
  const locale = useLocale()
  const t = useTranslations('auth')

  // Show a 404 error if the user requests an unknown locale
  if (params.locale !== locale) {
    notFound()
  }

  return (
    <ThemeWrapper lang={locale} className={inter.variable}>
      <ProviderWrapper>
        <Navbar signOutLabel={t('signOut')} />
        {children}
      </ProviderWrapper>
    </ThemeWrapper>
  )
}
