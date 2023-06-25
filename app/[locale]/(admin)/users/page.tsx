import {useTranslations} from 'next-intl'
import {Suspense} from 'react'
import FancyHeading from '~/components/fancy-heading'
import Table from '~/components/table'
import TablePlaceholder from '~/components/table-placeholder'

export default function Users() {
  const t = useTranslations('users')

  return (
    <>
      <FancyHeading className="mb-4" title={t('title')} />
      <Suspense fallback={<TablePlaceholder />}>
        <Table />
      </Suspense>
    </>
  )
}
