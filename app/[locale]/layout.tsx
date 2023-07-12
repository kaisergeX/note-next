import {type ReactNode} from 'react'
import {Analytics} from '@vercel/analytics/react'
import {Inter} from 'next/font/google'
import {useLocale, useTranslations} from 'next-intl'
import {notFound} from 'next/navigation'
import ProviderWrapper from '~/components/layouts/provider-wrapper'
import Navbar from '~/components/layouts/navbar'
import ThemeWrapper from '~/components/layouts/theme-wrapper'
import ScrollTopButton from '~/components/layouts/scroll-top-button'
import type {Metadata} from 'next'
import {getTranslator} from 'next-intl/server'
import '../globals.css'

export async function generateMetadata({
  params: {locale},
}: {
  params: {locale: string}
}): Promise<Metadata> {
  const t = await getTranslator(locale, 'common')

  return {
    title: process.env.SERVICE_NAME ?? t('app'),
    description: t('slogan'),
  }
}

const inter = Inter({subsets: ['latin'], variable: '--font-inter'})

type Props = {
  children: ReactNode
  params: {locale: string}
}

export default function LocaleLayout({children, params}: Props) {
  const locale = useLocale()
  const t = useTranslations()

  // Show a 404 error if the user requests an unknown locale
  if (params.locale !== locale) {
    notFound()
  }

  return (
    <ThemeWrapper lang={locale} className={inter.variable}>
      <ProviderWrapper>
        <Navbar appName={t('common.app')} signOutLabel={t('auth.signOut')} />
        {children}

        <Analytics />
        <ScrollTopButton />
      </ProviderWrapper>
    </ThemeWrapper>
  )
}
