import type {Metadata} from 'next'
import {getTranslator} from 'next-intl/server'
import {type ReactNode} from 'react'

export async function generateMetadata({
  params: {locale},
}: {
  params: {locale: string}
}): Promise<Metadata> {
  const t = await getTranslator(locale, 'admin')

  return {
    title: `${t('title')} | ${process.env.SERVICE_NAME ?? ''}`,
    description: t('description', {serviceName: process.env.SERVICE_NAME}),
  }
}

type Props = {
  children: ReactNode
}

export default function AdminLayout({children}: Props) {
  return (
    <main className="bg-fancy flex-center h-full flex-col p-4">{children}</main>
  )
}
