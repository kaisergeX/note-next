import {getTranslations} from 'next-intl/server'
export default async function TrashLoading() {
  const t = await getTranslations('note.trash')
  return (
    <div
      className="container mx-auto max-w-4xl space-y-4 p-4 py-8"
      role="status"
    >
      <span className="sr-only">{t('loading')}</span>
      {[1, 2, 3].map((id) => (
        <div
          key={id}
          className="bg-paper-raised border-hairline h-24 animate-pulse rounded-lg border motion-reduce:animate-none"
        />
      ))}
    </div>
  )
}
