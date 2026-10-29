'use client'

import {useMemo} from 'react'
import {useTranslations} from 'next-intl'
import {IconPalette} from '@tabler/icons-react'
import {Badge} from '~/components/ui/badge'
import {diffDocument, diffText} from '~/lib/notes/diff'
import type {NoteSnapshot} from '~/lib/notes/sync'

export default function NoteVersionDiff({
  saved,
  mine,
  side,
}: {
  saved: NoteSnapshot
  mine: NoteSnapshot
  side: 'mine' | 'saved'
}) {
  const t = useTranslations('note.recovery.diff')
  const fields = useMemo(
    () =>
      (['title', 'content'] as const).map((key) => {
        const before = diffDocument(saved[key])
        const after = diffDocument(mine[key])
        return {
          key,
          changed: saved[key] !== mine[key],
          structureChanged:
            before.structure !== after.structure ||
            (saved[key] !== mine[key] && before.text === after.text),
          empty: !(side === 'mine' ? after.text : before.text),
          ...diffText(before.text, after.text),
        }
      }),
    [saved, mine, side],
  )
  return (
    <div className="bg-paper-raised text-ink min-h-full space-y-5 p-3 sm:p-4">
      <p className="text-ink-muted text-xs">{t('direction')}</p>
      {saved.theme !== mine.theme && (
        <div className="font-sans">
          <Badge className="max-w-full gap-2 whitespace-normal">
            <IconPalette size={16} aria-hidden className="shrink-0" />
            {t('colorChanged')}
          </Badge>
        </div>
      )}
      {fields.map(
        ({key, changed, structureChanged, changes, coarse, empty}) => (
          <section key={key} className="space-y-2">
            <h4 className="font-sans text-sm font-semibold">{t(key)}</h4>
            {!changed ? (
              <p className="text-ink-muted text-sm">{t('unchanged')}</p>
            ) : (
              <>
                {structureChanged && (
                  <p className="text-ink-muted text-xs">
                    {t('structureChanged')}
                  </p>
                )}
                {coarse && (
                  <p className="text-ink-muted text-xs">{t('coarse')}</p>
                )}
                <div className="font-serif text-base wrap-anywhere whitespace-pre-wrap">
                  {empty && (
                    <span className="text-ink-muted text-sm">{t('empty')}</span>
                  )}
                  {changes.map((change, index) => {
                    if (
                      (side === 'mine' && change.removed) ||
                      (side === 'saved' && change.added)
                    )
                      return null
                    if (change.added || change.removed) {
                      const Tag = change.added ? 'ins' : 'del'
                      return (
                        <Tag
                          key={index}
                          className={
                            change.added
                              ? 'bg-success/10 decoration-success underline decoration-2 underline-offset-2'
                              : 'bg-destructive/10 decoration-destructive line-through decoration-2'
                          }
                        >
                          <span className="sr-only">
                            {t(change.added ? 'addedStart' : 'removedStart')}
                          </span>
                          {change.value}
                          <span className="sr-only">{t('changeEnd')}</span>
                        </Tag>
                      )
                    }
                    return <span key={index}>{change.value}</span>
                  })}
                </div>
                {changes.every(
                  (change) => !change.added && !change.removed,
                ) && <p className="text-ink-muted text-xs">{t('sameText')}</p>}
              </>
            )}
          </section>
        ),
      )}
    </div>
  )
}
