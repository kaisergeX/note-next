import type {Metadata} from 'next'
import {useTranslations} from 'next-intl'
import {getTranslations} from 'next-intl/server'
import {IconHome} from '@tabler/icons-react'
import LinkButton from '~/components/ui/link-button'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: `429 | ${process.env.SERVICE_NAME ?? t('common.app')}`,
    description: t('common.slogan'),
  }
}

export default function PermissionDenied() {
  const t = useTranslations('common.navigation')
  const pages = useTranslations('common.pages')

  return (
    <main className="flex-center h-full flex-col p-4">
      <div className="divide-hairline mb-8 items-stretch gap-4 max-sm:text-center sm:flex sm:divide-x">
        <h1 className="content-center sm:pr-4">429</h1>
        <div className="sm:py-2">
          <h2>{pages('rateLimitTitle')}</h2>
          <p className="text-ink-muted mt-4 text-sm">
            {pages('rateLimitBody')}
          </p>
          <p className="text-ink-muted mt-2 text-sm">{pages('support')}</p>
        </div>
      </div>

      <LinkButton href="/">
        <IconHome /> {t('home')}
      </LinkButton>
    </main>
  )
}
