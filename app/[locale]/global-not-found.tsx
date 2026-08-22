import {IconArrowLeft} from '@tabler/icons-react'
import type {Metadata} from 'next'
import {getLocale, getTranslations} from 'next-intl/server'
import {Inter} from 'next/font/google'
import Link from 'next/link'
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

export default async function GlobalNotFound() {
  const locale = await getLocale()
  const t = await getTranslations('common.navigation')

  return (
    <html lang={locale} className={inter.className}>
      <body className="flex-center h-full flex-col p-4">
        <div className="mb-8 items-stretch gap-4 divide-slate-400 max-sm:text-center sm:flex sm:divide-x">
          <h1 className="content-center sm:pr-4">404</h1>
          <h2 className="sm:py-2">This page could not be found.</h2>
        </div>

        <div className="flex gap-4">
          <GoBackButton className="button">
            <IconArrowLeft /> {t('back')}
          </GoBackButton>
          <Link href="/" className="button-secondary icon">
            🏡 {t('home')}
          </Link>
        </div>
      </body>
    </html>
  )
}
