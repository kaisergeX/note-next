'use client'
import {useTranslations} from 'next-intl'
import Button from '~/components/ui/button'
export default function TrashError({reset}: {reset: () => void}) {
  const t = useTranslations('note.trash')
  return (
    <main className="container mx-auto max-w-4xl space-y-4 p-4 py-8">
      <p role="alert" className="text-destructive">
        {t('loadFailed')}
      </p>
      <Button variant="secondary" onClick={reset}>
        {t('retry')}
      </Button>
    </main>
  )
}
