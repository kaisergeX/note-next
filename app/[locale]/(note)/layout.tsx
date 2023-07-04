import type {Metadata} from 'next'
import {getTranslator} from 'next-intl/server'
import {type ReactNode} from 'react'

export async function generateMetadata({
  params: {locale},
}: {
  params: {locale: string}
}): Promise<Metadata> {
  const t = await getTranslator(locale, 'common')

  return {
    title: process.env.SERVICE_NAME ?? t('app'),
    description: t('slogan'),
  }
}

type Props = {
  children: ReactNode
}

export default function NoteLayout({children}: Props) {
  return children
}
