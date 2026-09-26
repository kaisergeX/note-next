import type {Metadata} from 'next'
import {useTranslations} from 'next-intl'
import {getTranslations} from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()

  return {
    title: `${t('ai.interview.title')} | ${
      process.env.SERVICE_NAME ?? t('common.app')
    }`,
    description: t('ai.interview.placeholder'),
  }
}

export default function InterviewPage() {
  const t = useTranslations('ai.interview')

  return (
    <main className="flex-center h-full flex-col p-4">
      <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{t('placeholder')}</p>
    </main>
  )
}
