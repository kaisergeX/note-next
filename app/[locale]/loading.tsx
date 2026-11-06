import {getTranslations} from 'next-intl/server'
import LogoLoading from '~/components/layouts/logo-loading'

export default async function Loading() {
  const t = await getTranslations()
  return <LogoLoading className="min-h-0 flex-1" label={t('common.loading')} />
}
