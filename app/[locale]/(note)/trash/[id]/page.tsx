import {getLocale} from 'next-intl/server'
import {redirect} from '~/i18n/navigation'

export default async function TrashNotePage() {
  redirect({href: '/trash', locale: await getLocale()})
}
