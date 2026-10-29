import {redirect} from '~/i18n/navigation'
import {requireAuth} from '~/server-utils'
import type {PropsWithLocale} from '~/types'

export default async function NoteDraftsPage({params}: PropsWithLocale) {
  await requireAuth()
  redirect({
    href: '/collection/browser-work',
    locale: (await params).locale,
  })
}
