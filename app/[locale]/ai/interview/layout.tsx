import {NextIntlClientProvider} from 'next-intl'
import {getMessages} from 'next-intl/server'
import {redirect} from 'next/navigation'
import {requireFeatureAccess} from '~/lib/ai/feature-access'
import {requireAuth} from '~/server-utils'
import type {PropsWithLocale} from '~/types'

export default async function InterviewLayout({
  params,
  children,
}: PropsWithLocale<LayoutProps<'/[locale]/ai/interview'>>) {
  const {userInfo} = await requireAuth()

  try {
    await requireFeatureAccess(userInfo.id, 'persona-interview')
  } catch (err) {
    if (err instanceof Error && err.name === 'FeatureAccessError') {
      redirect('/denied/ai-access')
    }
    throw err
  }

  const locale = (await params).locale
  const aiFeatMsgs = (await getMessages({locale})).ai

  return (
    <main className="flex-center h-full flex-col p-4">
      <NextIntlClientProvider messages={{ai: aiFeatMsgs}}>
        {children}
      </NextIntlClientProvider>
    </main>
  )
}
