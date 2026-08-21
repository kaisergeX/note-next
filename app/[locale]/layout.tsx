import {Analytics} from '@vercel/analytics/react'
import {SpeedInsights} from '@vercel/speed-insights/next'
import type {Metadata, Viewport} from 'next'
import {getLocale, getTranslations} from 'next-intl/server'
import {Inter} from 'next/font/google'
import {Suspense} from 'react'
import AppHeader from '~/components/layouts/app-header'
import DevtoolsWarnWrapper from '~/components/layouts/devtools-warn-wrapper'
import ProviderWrapper from '~/components/layouts/provider-wrapper'
import ScrollTopButton from '~/components/layouts/scroll-top-button'
import ThemeWrapper from '~/components/layouts/theme-wrapper'
import IosSplashLinks from '~/components/ui/ios-splash-screen'
import {localeRouting} from '~/i18n/routing'
import '../globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common')
  const title = process.env.SERVICE_NAME ?? t('app')

  return {
    title,
    description: t('slogan'),
    applicationName: title,
    appleWebApp: {
      title,
      capable: true,
      statusBarStyle: 'default',
    },
    openGraph: {
      title,
      siteName: title,
      description: t('slogan'),
      type: 'website',
    },
  }
}

export const viewport: Viewport = {
  viewportFit: 'cover',
  themeColor: [
    {media: '(prefers-color-scheme: light)', color: '#fafafa'},
    {media: '(prefers-color-scheme: dark)', color: '#1b1718'},
  ],
}

export function generateStaticParams() {
  return localeRouting.locales.map((locale) => ({locale}))
}

const inter = Inter({subsets: ['latin'], variable: '--font-inter'})

export default async function LocaleLayout({
  children,
}: LayoutProps<'/[locale]'>) {
  const locale = await getLocale()
  const t = await getTranslations()

  return (
    <ThemeWrapper
      lang={locale}
      className={inter.variable}
      data-scroll-behavior="smooth"
    >
      <ProviderWrapper>
        <DevtoolsWarnWrapper
          message={
            <>
              <h1>{t('common.devtools.warn')}</h1>
              <p>{t('common.devtools.description')}</p>
            </>
          }
        >
          <IosSplashLinks />
          <Suspense>
            <AppHeader
              appName={t('common.app')}
              signOutLabel={t('auth.signOut')}
            />
          </Suspense>
          {children}
          <ScrollTopButton />

          <Analytics mode="production" />
          <SpeedInsights />
        </DevtoolsWarnWrapper>
      </ProviderWrapper>
    </ThemeWrapper>
  )
}
