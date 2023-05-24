import {useTranslations} from 'next-intl'
import {Suspense} from 'react'
import FancyHeading from '~/components/fancy-heading'
import Table from '~/components/table'
import TablePlaceholder from '~/components/table-placeholder'

export default function Home() {
  const t = useTranslations('homepage')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <FancyHeading className="mb-4" title={t('title')} />
      <Suspense fallback={<TablePlaceholder />}>
        {/* @ts-expect-error Async Server Component */}
        <Table />
      </Suspense>
    </main>
  )
}
