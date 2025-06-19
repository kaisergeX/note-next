import type {Metadata} from 'next'
import {getTranslations} from 'next-intl/server'
import type {ReactNode} from 'react'
import type {PropsWithLocale} from '~/types'
import {requireAuth} from '~/util'

type Props = {
  children: ReactNode
  modal: ReactNode
}

export async function generateMetadata(
  props: PropsWithLocale<Props>,
): Promise<Metadata> {
  const locale = (await props.params).locale
  const t = await getTranslations({locale})
  const appName = process.env.SERVICE_SHORTNAME ?? t('common.app')

  return {
    title: `${t('note.title')} | ${appName}`,
    description: t('common.slogan'),
  }
}

export default async function NoteLayout({children, modal}: Props) {
  await requireAuth()

  return (
    <>
      {children}
      {modal}
    </>
  )
}
