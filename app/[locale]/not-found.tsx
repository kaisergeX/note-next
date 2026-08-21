import {IconArrowLeft} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import GoBackButton from '~/components/navigation/go-back-button'
import {Link} from '~/i18n/navigation'

export default function NotFound() {
  const t = useTranslations('common.navigation')

  return (
    <main className="flex-center h-full flex-col p-4">
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
    </main>
  )
}
