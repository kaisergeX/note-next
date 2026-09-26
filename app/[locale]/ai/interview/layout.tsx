import {redirect} from 'next/navigation'
import {requireAuth} from '~/server-utils'
import {requireFeatureAccess} from '~/lib/ai/feature-access'

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

  return <main className="flex-center h-full flex-col p-4">{children}</main>
}
