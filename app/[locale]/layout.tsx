import {Analytics} from '@vercel/analytics/react'
import {SpeedInsights} from '@vercel/speed-insights/next'
import type {Metadata, Viewport} from 'next'
import {hasLocale} from 'next-intl'
import {getTranslations, setRequestLocale} from 'next-intl/server'
import {Inter} from 'next/font/google'
import {notFound} from 'next/navigation'
import DevtoolsWarnWrapper from '~/components/layouts/devtools-warn-wrapper'
import AppHeader from '~/components/layouts/app-header'
import ProviderWrapper from '~/components/layouts/provider-wrapper'
import ScrollTopButton from '~/components/layouts/scroll-top-button'
import ThemeWrapper from '~/components/layouts/theme-wrapper'
import IosSplashLinks from '~/components/ui/ios-splash-screen'
import {localeRouting} from '~/config/localization'
import type {Locales} from '~/types'
import '../globals.css'

export async function generateMetadata(
  props: LayoutProps<'/[locale]'>,
): Promise<Metadata> {
  const locale = (await props.params).locale as Locales
  const t = await getTranslations({locale, namespace: 'common'})
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
  params,
}: LayoutProps<'/[locale]'>) {
  const locale = (await params).locale

  // Show a 404 error if the user requests an unknown locale
  if (!hasLocale(localeRouting.locales, locale)) {
    notFound()
  }

  // Enable static rendering
  setRequestLocale(locale)

  const t = await getTranslations({locale})

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
          <AppHeader
            appName={t('common.app')}
            signOutLabel={t('auth.signOut')}
          />
          {children}
          <ScrollTopButton />

          <Analytics />
          <SpeedInsights />
        </DevtoolsWarnWrapper>
      </ProviderWrapper>
    </ThemeWrapper>
  )
}
