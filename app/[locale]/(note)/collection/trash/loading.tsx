import {getTranslations} from 'next-intl/server'
import styles from '~/components/note/trash/trash-layout.module.css'
import NoteCard from '~/components/note/note-card'
import {buttonClass} from '~/components/ui/button'
import {cn} from 'cn'
import {IconRestore, IconTrash} from '@tabler/icons-react'

const iconPlaceholderClass = cn(
  buttonClass({variant: 'ghost', iconOnly: true, size: 'sm'}),
  'bg-ink-tint',
)
const buttonPlaceholderClass = cn(
  buttonClass({variant: 'secondary'}),
  'bg-ink-tint border-transparent',
)
export default async function TrashLoading() {
  const t = await getTranslations('note.trash')
  return (
    <main className="w-full" role="status" aria-busy>
      <span className="sr-only">{t('loading')}</span>
      <div
        aria-hidden
        className="animate-pulse space-y-4 motion-reduce:animate-none"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="bg-ink-tint h-5 w-16 rounded-sm" />
          <div className="flex flex-wrap gap-2">
            <span className={buttonPlaceholderClass}>
              <span className="invisible flex items-center gap-2">
                <IconRestore size={18} />
                {t('bulk.restore')}
              </span>
            </span>
            <span className={buttonPlaceholderClass}>
              <span className="invisible flex items-center gap-2">
                <IconTrash size={18} />
                {t('bulk.empty')}
              </span>
            </span>
          </div>
        </div>
        <div className={`${styles.grid} grid gap-4`}>
          {Array.from({length: 6}).map((_, index) => (
            <NoteCard key={index}>
              <div className="space-y-3 p-4">
                <div
                  className={`bg-ink-tint h-6 max-w-80 rounded-sm ${index % 2 ? 'w-2/3' : 'w-1/2'}`}
                />
                <div className="flex h-10 flex-col justify-center gap-2">
                  <div className="bg-ink-tint h-3 w-5/6 rounded-sm" />
                  <div className="bg-ink-tint h-3 w-2/3 rounded-sm" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 px-3 pt-1 pb-2">
                <div className="bg-ink-tint h-4 w-1/2 max-w-48 rounded-sm" />
                <div className="flex shrink-0 gap-2">
                  <span className={iconPlaceholderClass} />
                  <span className={iconPlaceholderClass} />
                </div>
              </div>
            </NoteCard>
          ))}
        </div>
      </div>
    </main>
  )
}
