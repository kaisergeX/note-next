import type {Metadata} from 'next'
import {getTranslations} from 'next-intl/server'
import {ViewTransition} from 'react'
import {requireAuth} from '~/server-utils'

export const instant = false

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations()
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
