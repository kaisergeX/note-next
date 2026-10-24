import {getTranslations} from 'next-intl/server'
export default async function TrashLoading() {
  const t = await getTranslations('note.trash')
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4" role="status">
      <span className="sr-only">{t('loading')}</span>
      {Array.from({length: 3}).map((_, idx) => (
        <div
          key={idx}
          className="bg-paper-raised border-hairline h-24 animate-pulse rounded-lg border motion-reduce:animate-none"
        />
      ))}
    </div>
  )
}
