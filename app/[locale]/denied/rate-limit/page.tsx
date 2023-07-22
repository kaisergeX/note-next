import type {Metadata} from 'next'
import {useTranslations} from 'next-intl'
import {getTranslator} from 'next-intl/server'
import Link from 'next/link'

export async function generateMetadata({
  params: {locale},
}: {
  params: {locale: string}
}): Promise<Metadata> {
  const t = await getTranslator(locale)

  return {
    title: `429 | ${process.env.SERVICE_NAME ?? t('common.app')}`,
    description: t('common.slogan'),
  }
}

export default function PermissionDenied() {
  const t = useTranslations('common.navigation')

  return (
    <main className="flex-center h-full flex-col p-4">
      <div className="mb-8 items-center gap-4 divide-slate-400 sm-only:text-center sm:flex sm:divide-x">
        <h1>429</h1>
        <div className="py-4 pl-4">
          <h2>Rate limit exceeded</h2>
          <p className="mt-4 text-sm">
            We detected too many requests from your IP address in a short
            period.
            <br />
            If you believe this is an error, please contact etoN support team.
          </p>
        </div>
      </div>

      <Link href="/" className="button-secondary icon">
        🏡 {t('home')}
      </Link>
    </main>
  )
}
