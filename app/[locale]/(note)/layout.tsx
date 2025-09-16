import type {Metadata} from 'next'
import {getTranslations} from 'next-intl/server'
import type {PropsWithLocale} from '~/types'
import {requireAuth} from '~/util'

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

export default async function NoteLayout({
  children,
  modal,
}: LayoutProps<'/[locale]'>) {
  await requireAuth()

  return (
    <>
      {children}
      {modal}
    </>
  )
}
