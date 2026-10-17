import {useTranslations} from 'next-intl'
import {Suspense} from 'react'
import Table from '~/components/table'
import TablePlaceholder from '~/components/table-placeholder'

export default function Users() {
  const t = useTranslations('admin.users')

  return (
    <>
      <h1 className="mb-4">{t('title')}</h1>
      <Suspense fallback={<TablePlaceholder />}>
        <Table />
      </Suspense>
    </>
  )
}
