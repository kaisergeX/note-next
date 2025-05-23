import {IconArrowLeft} from '@tabler/icons-react'
import type {Metadata} from 'next'
import {useTranslations} from 'next-intl'
import {getTranslations} from 'next-intl/server'
import Link from 'next/link'
import GoBackButton from '~/components/navigation/go-back-button'
import type {PropsWithLocale} from '~/types'

export async function generateMetadata(
  props: PropsWithLocale,
): Promise<Metadata> {
  const locale = (await props.params).locale
  const t = await getTranslations({locale})

  return {
    title: `403 | ${process.env.SERVICE_NAME ?? t('common.app')}`,
    description: t('common.slogan'),
  }
}

export default function PermissionDenied() {
  const t = useTranslations('common.navigation')

  return (
    <main className="flex-center h-full flex-col p-4">
      <div className="mb-8 items-stretch gap-4 divide-slate-400 max-sm:text-center sm:flex sm:divide-x">
        <h1 className="content-center sm:pr-4">403</h1>
        <div className="sm:py-2">
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
