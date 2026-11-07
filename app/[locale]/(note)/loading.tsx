import {getTranslations} from 'next-intl/server'
import LogoLoading from '~/components/layouts/logo-loading'

export default async function Loading() {
  const t = await getTranslations()
  return (
    <LogoLoading
      className="min-h-0 flex-1"
      label={t('note.loading.collection')}
      captions={[
        t('common.loadingPhrases.gathering'),
        t('common.loadingPhrases.sharpening'),
        t('common.loadingPhrases.opening'),
        t('common.loadingPhrases.sketching'),
        t('common.loadingPhrases.ink'),
        t('common.loadingPhrases.inspiration'),
      ]}
    />
  )
}
