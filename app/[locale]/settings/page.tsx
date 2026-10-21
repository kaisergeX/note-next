import {getLocale} from 'next-intl/server'
import {redirect} from '~/i18n/navigation'

export default async function SettingsPage() {
  redirect({href: '/settings/account', locale: await getLocale()})
}
