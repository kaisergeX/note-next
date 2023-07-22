import {IconArrowLeft} from '@tabler/icons-react'
import type {Metadata} from 'next'
import {useTranslations} from 'next-intl'
import {getTranslator} from 'next-intl/server'
import Link from 'next/link'
import GoBackButton from '~/components/navigation/go-back-button'

export async function generateMetadata({
  params: {locale},
}: {
  params: {locale: string}
}): Promise<Metadata> {
  const t = await getTranslator(locale)

  return {
    title: `403 | ${process.env.SERVICE_NAME ?? t('common.app')}`,
    description: t('common.slogan'),
  }
}

export default function PermissionDenied() {
  const t = useTranslations('common.navigation')

  return (
    <main className="flex-center h-full flex-col p-4">
      <div className="mb-8 items-center gap-4 divide-slate-400 sm-only:text-center sm:flex sm:divide-x">
        <h1>403</h1>
        <div className="py-4 pl-4">
          <h2>Permission Denied</h2>
          <p className="mt-4 text-sm">
            You do not have permission to access this page.
            <br />
            If you believe this is an error, please contact etoN support team.
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <GoBackButton className="button">
          <IconArrowLeft /> {t('back')}
        </GoBackButton>
        <Link href="/" className="button-secondary icon">
          🏡 {t('home')}
        </Link>
      </div>
    </main>
  )
}
