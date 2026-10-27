import {getLocale} from 'next-intl/server'
import {redirect} from '~/i18n/navigation'

// Preserve existing saved links to Trash.
export default async function LegacyTrashPage() {
  redirect({href: '/collection/trash', locale: await getLocale()})
}
