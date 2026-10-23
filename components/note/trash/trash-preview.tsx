'use client'

import {useTranslations} from 'next-intl'
import {cn} from 'cn'
import {Link, useRouter} from '~/i18n/navigation'
import type {LifecycleNote} from '~/lib/notes/lifecycle'
import {noteText} from '~/lib/notes/text'
import {buttonClass} from '~/components/ui/button'
import NoteReadOnly from './note-read-only'
import TrashActions from './trash-actions'
import ExpiryDate from './expiry-date'
import {useTrashRefresh} from './use-trash-refresh'

export default function TrashPreview({
  note,
  serverNow,
}: {
  note: LifecycleNote
  serverNow: number
}) {
  const t = useTranslations('note.trash')
  const router = useRouter()
  const {now, online} = useTrashRefresh(serverNow, [note.deadlineToken!])
  const eligible = Date.parse(note.deadlineToken!) > now
  return (
    <div className="space-y-6">
      <Link className={buttonClass({variant: 'ghost'})} href="/trash">
        {t('backTrash')}
      </Link>
      {!online && (
        <p role="status" className="text-ink-muted text-sm">
          {t('offline')}
        </p>
      )}
      {!eligible ? (
        <p role="status" className="text-ink-muted">
          {t('changed')}
        </p>
      ) : (
        <>
          <header className="space-y-3">
            <p className="text-ink-muted text-sm">{t('readOnly')}</p>
            <h1 className="font-serif text-2xl wrap-anywhere sm:text-3xl">
              {noteText(note.title) || t('untitled')}
            </h1>
            <p className="text-ink-muted text-sm">
              <ExpiryDate deadline={note.deadlineToken!} />
            </p>
            <TrashActions
              item={{
                id: note.id,
                title: noteText(note.title),
                excerpt: '',
                deadlineToken: note.deadlineToken!,
              }}
              disabled={!online}
              onComplete={() => router.replace('/trash')}
            />
          </header>
          <article
            className={cn(
              'rounded-xl border p-4 sm:p-6',
              note.theme
                ? `dialog-${note.theme} border-theme-${note.theme}`
                : 'bg-paper-raised border-hairline',
            )}
          >
            <NoteReadOnly content={note.content} theme={note.theme} />
          </article>
        </>
      )}
    </div>
  )
}
