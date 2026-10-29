'use client'

import {useId, useState} from 'react'
import {IconCheck, IconChevronDown} from '@tabler/icons-react'
import {useLocale, useTranslations} from 'next-intl'
import type {Note} from '~/db/schema/notes'
import type {RecoveryDraft} from '~/lib/notes/drafts'
import {groupRecoveryDrafts} from '~/lib/notes/recovery-copies'
import {useRecoveryDrafts} from '~/lib/notes/use-recovery-drafts'
import Button, {buttonClass} from '~/components/ui/button'
import MenuCustom from '~/components/ui/menu'
import ConfirmationDialog from '~/components/ui/confirmation-dialog'
import NoteCard from './note-card'
import NoteReadOnly from './trash/note-read-only'
import RecoveryManagement from './recovery-management'

export default function NoteVersionPicker({
  note,
  records,
  onChoose,
  onClose,
  busy = false,
  dismissLabel = 'reviewLater',
}: {
  note?: Note
  records: RecoveryDraft[]
  onChoose: (record?: RecoveryDraft) => void
  onClose: () => void
  busy?: boolean
  dismissLabel?: 'reviewLater' | 'closeComparison'
}) {
  const t = useTranslations('note.recovery')
  const locale = useLocale()
  const titleId = useId()
  const descriptionId = useId()
  const live = useRecoveryDrafts(
    records[0]?.ownerId ?? note?.authorId ?? '',
    true,
  )
  const ids = new Set(records.map((record) => record.id))
  const groups = groupRecoveryDrafts(
    live.loaded && !live.error
      ? live.records.filter((record) => ids.has(record.id))
      : records,
  )
  const [selectedId, setSelectedId] = useState(groups[0]?.record.id)
  const selected =
    groups.find(({copies}) => copies.some((row) => row.id === selectedId)) ??
    groups[0]
  const dateFormat = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const dates = groups.map(({record}) => dateFormat.format(record.updatedAt))
  const label = (record: RecoveryDraft) => {
    const time = dateFormat.format(record.updatedAt)
    const sameTime = groups.filter((_, index) => dates[index] === time)
    return sameTime.length > 1
      ? t('browserCopyAtNumber', {
          time,
          number:
            sameTime.findIndex((group) => group.record.id === record.id) + 1,
        })
      : t('browserCopyAt', {time})
  }
  const panes = [
    ...(note ? [{key: 'saved', value: note, record: undefined}] : []),
    ...(selected
      ? [
          {
            key: 'browser',
            value: selected.record.draft,
            record: selected.record,
          },
        ]
      : []),
  ]
  return (
    <ConfirmationDialog
      open
      busy={busy}
      labelledBy={titleId}
      describedBy={descriptionId}
      initialFocusId={titleId}
      onRequestClose={onClose}
      layout="comparison"
    >
      <header className="shrink-0 p-4 sm:p-6">
        <h2 id={titleId} tabIndex={-1} className="text-lg font-semibold">
          {t('versionsTitle')}
        </h2>
        <p id={descriptionId} className="text-ink-muted mt-2 text-sm">
          {t('compareVersionsHelp')}
        </p>
      </header>
      {live.error && (
        <p role="alert" className="text-destructive px-4 pb-3 text-sm sm:px-6">
          {t('recoveryFailed')}
        </p>
      )}
      {!groups.length && (
        <p role="status" className="text-ink-muted px-4 pb-3 text-sm sm:px-6">
          {t('noBrowserVersions')}
        </p>
      )}
      <div
        className={`grid min-h-0 flex-1 gap-6 overflow-y-auto px-4 pt-2 pb-4 sm:overflow-hidden sm:px-6 ${note && selected ? 'sm:grid-cols-2' : ''}`}
      >
        {panes.map(({key, value, record}) => (
          <section key={key} className="flex min-h-0 min-w-0 flex-col gap-3">
            <div className="flex min-h-10 items-center justify-between gap-2">
              {record && groups.length > 1 ? (
                <MenuCustom
                  ariaLabel={`${t('chooseBrowserVersion')}: ${t('storedInBrowserAt', {time: dateFormat.format(selected.record.updatedAt)})}`}
                  disabled={busy}
                  className={buttonClass({variant: 'secondary'})}
                  itemsClassName="w-72 p-1"
                  items={groups.map(({record: item}) => ({
                    type: 'action',
                    label: (
                      <>
                        <span className="flex-1">{label(item)}</span>
                        {item.id === selected.record.id && (
                          <IconCheck size={16} aria-hidden />
                        )}
                      </>
                    ),
                    onSelect: () => setSelectedId(item.id),
                  }))}
                >
                  {label(selected.record)}
                  <IconChevronDown size={16} aria-hidden />
                </MenuCustom>
              ) : (
                <h3 className="font-semibold">
                  {record ? label(record) : t('saved')}
                </h3>
              )}
              {record && (
                <RecoveryManagement
                  ownerId={record.ownerId}
                  records={selected.copies}
                />
              )}
            </div>
            <NoteCard
              theme={value.theme}
              className="flex min-h-40 flex-1 flex-col overflow-hidden max-sm:max-h-80 sm:min-h-0"
            >
              <div
                role="region"
                aria-label={t(record ? 'browserVersion' : 'saved')}
                tabIndex={0}
                className="focus-visible:outline-accent min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 focus-visible:outline-2 focus-visible:-outline-offset-2"
              >
                {value.title && (
                  <NoteReadOnly
                    content={value.title}
                    theme={value.theme}
                    className="mb-3 font-serif text-lg font-semibold"
                  />
                )}
                <NoteReadOnly
                  content={value.content}
                  theme={value.theme}
                  className="font-serif"
                />
              </div>
            </NoteCard>
            <Button
              className="shrink-0"
              variant={record ? 'primary' : 'secondary'}
              disabled={busy}
              onClick={() => onChoose(record)}
            >
              {t(record ? 'continueVersion' : 'openSaved')}
            </Button>
          </section>
        ))}
      </div>
      <footer className="border-hairline flex shrink-0 justify-end border-t px-4 py-3 sm:px-6">
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          {t(dismissLabel)}
        </Button>
      </footer>
    </ConfirmationDialog>
  )
}
