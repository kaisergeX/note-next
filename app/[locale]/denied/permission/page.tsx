import type {Metadata} from 'next'
import {useTranslations} from 'next-intl'
import {getTranslations} from 'next-intl/server'
import {IconHome} from '@tabler/icons-react'
import LinkButton from '~/components/ui/link-button'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: `403 | ${process.env.SERVICE_NAME ?? t('common.app')}`,
    description: t('common.slogan'),
  }
}

export default function PermissionDenied() {
  const t = useTranslations('common.navigation')

  return (
    <main className="flex-center h-full flex-col p-4">
      <div className="divide-hairline mb-8 items-stretch gap-4 max-sm:text-center sm:flex sm:divide-x">
        <h1 className="content-center sm:pr-4">403</h1>
        <div className="sm:py-2">
          <h2>Permission Denied</h2>
          <p className="text-ink-muted mt-4 text-sm">
            You do not have permission to access this page.
            <br />
            If you believe this is an error, please contact etoN support team.
          </p>
        </div>
      </div>

      <LinkButton href="/">
        <IconHome /> {t('home')}
      </LinkButton>
    </main>
  )
}
