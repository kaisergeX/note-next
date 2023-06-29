import {IconArrowLeft} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import GoBackButton from '~/components/navigation/go-back-button'

export default function NotFound() {
  const t = useTranslations('common.navigation')

  return (
    <main className="flex-center h-full flex-col p-4">
      <div className="mb-8 flex items-center gap-4 divide-x divide-slate-400">
        <h1>404</h1>
        <h2 className="py-4 pl-4">This page could not be found.</h2>
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
