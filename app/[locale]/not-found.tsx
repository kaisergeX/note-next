import {IconArrowLeft, IconHome} from '@tabler/icons-react'
import {useTranslations} from 'next-intl'
import LinkButton from '~/components/ui/link-button'
import GoBackButton from '~/components/navigation/go-back-button'

export default function NotFound() {
  const t = useTranslations('common.navigation')

  return (
    <main className="flex-center h-full flex-col p-4">
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
    </main>
  )
}
