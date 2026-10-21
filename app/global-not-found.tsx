import './globals.css'

import {IconArrowLeft, IconHome} from '@tabler/icons-react'
import type {Metadata} from 'next'
import {getLocale, getTranslations} from 'next-intl/server'
import {Inter} from 'next/font/google'
import {createAppearanceBootstrapScript} from '~/lib/appearance'
import LinkButton from '~/components/ui/link-button'
import GoBackButton from '~/components/navigation/go-back-button'

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

const inter = Inter({subsets: ['latin'], variable: '--font-inter'})

const appearanceScript = createAppearanceBootstrapScript()

export default async function GlobalNotFound() {
  const locale = await getLocale()
  const t = await getTranslations('common.navigation')

  return (
    <html
      lang={locale}
      className={inter.variable}
      data-appearance="paper-ink"
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content="" />
        <script dangerouslySetInnerHTML={{__html: appearanceScript}} />
      </head>
      <body className="flex-center bg-paper text-ink min-h-dvh flex-col p-4 font-sans">
        <div className="divide-hairline mb-8 items-stretch gap-4 max-sm:text-center sm:flex sm:divide-x">
          <h1 className="content-center sm:pr-4">404</h1>
          <h2 className="sm:py-2">This page could not be found.</h2>
        </div>

        <div className="flex gap-4">
          <GoBackButton>
            <IconArrowLeft /> {t('back')}
          </GoBackButton>
          <LinkButton href="/">
            <IconHome /> {t('home')}
          </LinkButton>
        </div>
      </body>
    </html>
  )
}
