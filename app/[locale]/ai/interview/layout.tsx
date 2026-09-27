import {NextIntlClientProvider} from 'next-intl'
import {getLocale, getMessages} from 'next-intl/server'
import {redirect} from 'next/navigation'
import {requireFeatureAccess} from '~/lib/ai/feature-access'
import {requireAuth} from '~/server-utils'

export default async function InterviewLayout({
  children,
}: LayoutProps<'/[locale]/ai/interview'>) {
  const {userInfo} = await requireAuth()

  try {
    await requireFeatureAccess(userInfo.id, 'persona-interview')
  } catch (err) {
    if (err instanceof Error && err.name === 'FeatureAccessError') {
      redirect('/denied/ai-access')
    }
    throw err
  }

  // Next's generated LayoutProps types `locale` as a bare string; the
  // next-intl request locale is the properly narrowed value.
  const locale = await getLocale()
  const aiFeatMsgs = (await getMessages({locale})).ai

  return (
    <main className="body-h-auto flex h-full grow flex-col">
      <NextIntlClientProvider messages={{ai: aiFeatMsgs}}>
        {children}
      </NextIntlClientProvider>
    </main>
  )
}
