import {NextIntlClientProvider} from 'next-intl'
import {getMessages} from 'next-intl/server'
import AppearanceSettings from '~/components/settings/appearance-settings'

export default async function AppearancePage() {
  const messages = await getMessages()
  return (
    <NextIntlClientProvider messages={{user: messages.user}}>
      <AppearanceSettings />
    </NextIntlClientProvider>
  )
}
