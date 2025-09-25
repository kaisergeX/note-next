import type {Metadata} from 'next'
import {getTranslations} from 'next-intl/server'
import {unstable_ViewTransition as ViewTransition} from 'react'
import {requireAuth} from '~/server-utils'
import type {PropsWithLocale} from '~/types'

export async function generateMetadata(
  props: PropsWithLocale<LayoutProps<'/[locale]'>>,
): Promise<Metadata> {
  const locale = (await props.params).locale
  const t = await getTranslations({locale})
  const appName = process.env.SERVICE_SHORTNAME ?? t('common.app')

  return {
    title: `${t('note.title')} | ${appName}`,
    description: t('common.slogan'),
  }
}

export default async function NoteLayout({children}: LayoutProps<'/[locale]'>) {
  await requireAuth()

  return <ViewTransition>{children}</ViewTransition>
}
