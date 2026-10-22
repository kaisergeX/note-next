import {getLocale, getTranslations} from 'next-intl/server'
import {NextIntlClientProvider} from 'next-intl'
import SettingsNavigation from '~/components/settings/settings-navigation'

export default async function SettingsLayout({
  children,
}: React.PropsWithChildren) {
  const locale = await getLocale()
  const t = await getTranslations('user.settings')
  return (
    <main className="mx-auto w-full max-w-7xl p-4 pb-12 sm:pt-8">
      <h1>{t('title')}</h1>
      <div className="mt-6 flex flex-col gap-6 md:flex-row md:gap-8">
        <NextIntlClientProvider locale={locale} messages={{}}>
          <SettingsNavigation
            labels={{
              navigation: t('navigation'),
              account: t('account'),
              appearance: t('appearance'),
            }}
          />
        </NextIntlClientProvider>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </main>
  )
}
