import RefreshButton from './refresh-button'
import {getTranslations} from 'next-intl/server'
import LoadingIndicator from '~/components/ui/loading-indicator'

export default async function TablePlaceholder() {
  const t = await getTranslations('common')
  return (
    <div className="border-hairline bg-paper-raised mx-auto w-full max-w-xl rounded-lg border p-12">
      <div className="mb-4 flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Recent Users</h2>
          <LoadingIndicator label={t('loadingUsers')} />
        </div>
        <RefreshButton
          labels={{
            refresh: t('action.refresh'),
            refreshing: t('action.refreshing'),
          }}
        />
      </div>
      <div className="divide-hairline divide-y">
        {Array.from(Array(3).keys()).map((i) => (
          <div key={i} className="flex items-center justify-between py-3">
            <div className="flex items-center space-x-4">
              <div className="bg-ink-tint h-12 w-12 rounded-full motion-safe:animate-pulse" />
              <div className="space-y-1">
                <div className="bg-ink-tint h-6 w-28 rounded-md motion-safe:animate-pulse" />
                <div className="bg-ink-tint h-4 w-24 rounded-md motion-safe:animate-pulse" />
              </div>
            </div>
            <div className="bg-ink-tint h-4 w-12 rounded-md motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
