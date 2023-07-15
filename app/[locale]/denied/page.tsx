import {IconArrowLeft} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import Link from 'next/link'
import GoBackButton from '~/components/navigation/go-back-button'

export const metadata = {
  title: '403 - etoN',
  description: 'A minimalistic note-taking app for everyone.',
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
