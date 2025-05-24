import type {Metadata} from 'next'
import {getTranslations} from 'next-intl/server'
import {redirect} from 'next/navigation'
import {type ReactNode} from 'react'
import type {PropsWithLocale} from '~/types'
import {isArchivist, requireAuth} from '~/util'

export async function generateMetadata(
  props: PropsWithLocale,
): Promise<Metadata> {
  const locale = (await props.params).locale
  const t = await getTranslations({locale})

  return {
    title: `${t('admin.title')} | ${
      process.env.SERVICE_NAME ?? t('common.app')
    }`,
    description: t('admin.description', {
      serviceName: process.env.SERVICE_NAME ?? t('common.app'),
      slogan: t('common.slogan'),
    }),
  }
}

type Props = {
  children: ReactNode
}

export default async function AdminLayout({children}: Props) {
  const session = await requireAuth()
  if (!isArchivist(session)) {
    return redirect('/denied/permission')
  }

  return (
    <main className="bg-fancy flex-center h-full flex-col p-4">{children}</main>
  )
}
