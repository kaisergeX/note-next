import {Analytics} from '@vercel/analytics/react'
import {SpeedInsights} from '@vercel/speed-insights/next'
import type {Metadata} from 'next'
import {useLocale, useTranslations} from 'next-intl'
import {getTranslations} from 'next-intl/server'
import {Inter} from 'next/font/google'
import {notFound} from 'next/navigation'
import {type PropsWithChildren, use} from 'react'
import Navbar from '~/components/layouts/navbar'
import ProviderWrapper from '~/components/layouts/provider-wrapper'
import ScrollTopButton from '~/components/layouts/scroll-top-button'
import ThemeWrapper from '~/components/layouts/theme-wrapper'
import type {PropsWithLocale} from '~/types'
import '../globals.css'

export async function generateMetadata(
  props: PropsWithLocale,
): Promise<Metadata> {
  const locale = (await props.params).locale
  const t = await getTranslations({locale, namespace: 'common'})

  return {
    title: process.env.SERVICE_NAME ?? t('app'),
    description: t('slogan'),
  }
}

const inter = Inter({subsets: ['latin'], variable: '--font-inter'})

export default function LocaleLayout({
  children,
  params,
}: PropsWithChildren<PropsWithLocale>) {
  const localeParams = use(params).locale
  const locale = useLocale()
  const t = useTranslations()

  // Show a 404 error if the user requests an unknown locale
  if (localeParams !== locale) {
    notFound()
  }

  return (
    <ThemeWrapper lang={locale} className={inter.variable}>
      <ProviderWrapper>
        <Navbar appName={t('common.app')} signOutLabel={t('auth.signOut')} />
        {children}

        <Analytics />
        <SpeedInsights />
        <ScrollTopButton />
      </ProviderWrapper>
    </ThemeWrapper>
  )
}
