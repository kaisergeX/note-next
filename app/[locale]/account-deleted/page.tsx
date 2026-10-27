import {getTranslations} from 'next-intl/server'
import LinkButton from '~/components/ui/link-button'

export default async function AccountDeletedPage({
  params,
  searchParams,
}: PageProps<'/[locale]/account-deleted'>) {
  const {locale: requestedLocale} = await params
  const locale = requestedLocale === 'vi' ? 'vi' : 'en'
  const t = await getTranslations({
    locale,
    namespace: 'user.settings.dataActions',
  })
  const recovery = await getTranslations({locale, namespace: 'note.recovery'})
  const localRecoveryFailed = (await searchParams).localRecovery === 'failed'
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-12">
      <h1>{t('deletedTitle')}</h1>
      <p className="text-ink-muted mt-4">{t('deletedBody')}</p>
      {localRecoveryFailed && (
        <p role="alert" className="text-warning mt-4">
          {recovery('deletedStorageFailed')}
        </p>
      )}
      <LinkButton
        href={`/${locale}/login`}
        className="mt-6 h-auto min-h-11 py-2.5 whitespace-normal"
      >
        {t('startAgain')}
      </LinkButton>
    </main>
  )
}
