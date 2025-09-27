import type {Metadata} from 'next'
import {getTranslations} from 'next-intl/server'
import {redirect} from 'next/navigation'
import {requireAuth} from '~/server-utils'
import type {PropsWithLocale} from '~/types'

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

export default async function AdminLayout({
  children,
}: LayoutProps<'/[locale]/admin'>) {
  const {isArchivist} = await requireAuth()
  if (!isArchivist) {
    return redirect('/denied/permission')
  }

  return (
    <main className="bg-fancy flex-center body-dvh h-full flex-col p-4">
      {children}
    </main>
  )
}
