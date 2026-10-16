import '../globals.css'

import {IconArrowLeft, IconHome} from '@tabler/icons-react'
import type {Metadata} from 'next'
import {getLocale, getTranslations} from 'next-intl/server'
import {Inter} from 'next/font/google'
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

const darkModeScript = `(function(){try{var s=JSON.parse(localStorage.getItem('${
  process.env.SERVICE_NAME ?? 'etoN-app'
}')||'null');var t=s&&s.state&&s.state.theme;if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`

export default async function GlobalNotFound() {
  const locale = await getLocale()
  const t = await getTranslations('common.navigation')

  return (
    <html lang={locale} className={inter.className} suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{__html: darkModeScript}} />
      <body className="flex-center bg-paper text-ink h-full flex-col p-4">
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
