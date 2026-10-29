'use client'

import {useEffect, useState} from 'react'
import {useTranslations} from 'next-intl'
import {IconArrowLeft} from '@tabler/icons-react'
import {cn} from 'cn'
import type {Note} from '~/db/schema/notes'
import {useRecoveryDrafts} from '~/lib/notes/use-recovery-drafts'
import {
  groupNoteRecovery,
  groupRecoveryDrafts,
} from '~/lib/notes/recovery-copies'
import {usePersistStore} from '~/store'
import {useMobileNoteView} from '~/lib/notes/mobile'
import {Link} from '~/i18n/navigation'
import Button, {buttonClass} from '~/components/ui/button'
import NoteTiny from './note-tiny'
import RecoveryStatus from './recovery-status'
import RecoveryManagement from './recovery-management'
import NoteCreateEditor from './note-create'
import {useMasonry} from '~/util/hooks/use-masonry'
import CollectionTitle from './collection-title'
import {withBrowserWorkReturn} from '~/lib/notes/navigation'

export default function NotesCollection({
  ownerId,
  notes,
  browserWorkOnly = false,
}: {
  ownerId: string
  notes: Note[]
  browserWorkOnly?: boolean
}) {
  const t = useTranslations('note.recovery')
  const editor = useTranslations('note.editor')
  const mobile = useMobileNoteView()
  const {records, loaded, error} = useRecoveryDrafts(ownerId, true)
  const [acknowledged, setAcknowledged] = useState<{
    source: Note[]
    notes: Record<string, Note>
  }>({source: notes, notes: {}})
  const active = usePersistStore((state) => state.noteSession)
  const [filter, setFilter] = useState<'all' | 'review'>('all')
  const [ordering, setOrdering] = useState<{ownerId: string; ids: string[]}>({
    ownerId,
    ids: [],
  })
  useEffect(() => {
    const saved = (event: Event) => {
      const note = (event as CustomEvent<Note>).detail
      if (note.authorId === ownerId)
        setAcknowledged((previous) => ({
          source: notes,
          notes: {
            ...(previous.source === notes ? previous.notes : {}),
            [note.id]: note,
          },
        }))
    }
    window.addEventListener('note-saved', saved)
    return () => window.removeEventListener('note-saved', saved)
  }, [ownerId, notes])
  const server = new Map(
    notes
      .filter((note) => note.authorId === ownerId)
      .map((note) => [note.id, note]),
  )
  for (const note of Object.values(
    acknowledged.source === notes ? acknowledged.notes : {},
  )) {
    if (note.authorId !== ownerId) continue
    const current = server.get(note.id)
    if (!current || new Date(note.updatedAt) >= new Date(current.updatedAt))
      server.set(note.id, note)
  }
  const local = groupNoteRecovery(records)
  for (const [id, note] of server) if (note.pendingDeleteAt) server.delete(id)
  const present = new Set([...server.keys(), ...local.keys()])
  let ordered = ordering.ownerId === ownerId ? ordering.ids : []
  const known = new Set(ordered)
  const added = [...present].filter((id) => !known.has(id))
  if (added.length || ordering.ownerId !== ownerId) {
    ordered = [...ordered, ...added]
    setOrdering({ownerId, ids: ordered})
  }
  const ids = ordered.filter((id) => present.has(id))
  const reviewIds = ids.filter((id) => {
    const rows = local.get(id) ?? []
    return (
      rows.some((row) => row.conflict || row.unavailable) ||
      groupRecoveryDrafts(rows).length > 1
    )
  })
  const hasFilters =
    !browserWorkOnly && reviewIds.length > 0 && reviewIds.length < ids.length
  const displayed = browserWorkOnly
    ? ids.filter((id) => local.has(id))
    : hasFilters && filter === 'review'
      ? reviewIds
      : ids
  if (!hasFilters && filter !== 'all') setFilter('all')
  const list = useMasonry<HTMLUListElement>(
    loaded || error ? displayed.join('|') : 'loading',
  )
  const card = (id: string) => {
    const saved = server.get(id)
    const copies = local.get(id) ?? []
    const groups = groupRecoveryDrafts(copies)
    const record = groups[0]?.record
    const ambiguous = groups.length > 1
    const review = ambiguous || Boolean(record?.conflict)
    const unavailable = Boolean(record?.unavailable)
    const preview =
      !ambiguous && record
        ? {
            ...saved,
            ...record.baseline,
            ...record.draft,
            id,
            authorId: ownerId,
          }
        : saved
    // Multiple new-note versions have no server preview. Keep their common
    // identity and open a chooser rather than selecting a version by time.
    const data = preview ?? {id, title: null, content: null, theme: null}
    const href = browserWorkOnly
      ? withBrowserWorkReturn(
          saved
            ? `/full/eton/${id}${review ? '?review=1' : ''}`
            : `/full/eton/recover/${record!.id}${review ? '?review=1' : ''}`,
          true,
        )
      : saved
        ? undefined
        : `/full/eton/recover/${record!.id}${ambiguous ? '?review=1' : ''}`
    return (
      <li key={id} className="min-w-0">
        <NoteTiny
          data={data}
          href={href}
          localOnly={!saved || unavailable}
          pendingWork={copies.length > 0}
          notice={unavailable ? t('draftOriginalUnavailable') : undefined}
          actions={
            !saved && groups.length === 1
              ? () => <RecoveryManagement ownerId={ownerId} records={copies} />
              : undefined
          }
          status={
            copies.length ? (
              <div className="flex items-center gap-1">
                <RecoveryStatus review={review || unavailable} />
                {(review || unavailable) && (
                  <Link
                    className={buttonClass({variant: 'link', size: 'sm'})}
                    href={href ?? `${mobile ? '/full' : ''}/eton/${id}`}
                  >
                    {t(unavailable ? 'recoverNew' : 'reviewShort')}
                  </Link>
                )}
              </div>
            ) : undefined
          }
        />
      </li>
    )
  }
  return (
    <section aria-label={t(browserWorkOnly ? 'browserWorkTitle' : 'notesHome')}>
      <div
        id="browser-work"
        className={cn(
          'bg-paper sticky top-16 z-10 mb-4 flex min-h-10 items-center justify-between gap-6',
          hasFilters && 'py-2',
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {!browserWorkOnly && loaded && records.length > 0 && (
            <RecoveryManagement ownerId={ownerId} records={records} all />
          )}
          {browserWorkOnly && (
            <>
              <Link
                href="/eton"
                aria-label={t('backToNotes')}
                className={buttonClass({variant: 'ghost', iconOnly: true})}
              >
                <IconArrowLeft size={18} aria-hidden />
              </Link>
              <CollectionTitle title={t('browserWorkTitle')} />
            </>
          )}
          {hasFilters && (
            <div
              role="group"
              aria-label={t('filterNotes')}
              className="flex flex-wrap items-center gap-1"
            >
              <Button
                variant={filter === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={filter === 'all'}
                onClick={() => setFilter('all')}
              >
                {t('allNotesFilter')}
              </Button>
              {(reviewIds.length > 0 || filter === 'review') && (
                <Button
                  variant={filter === 'review' ? 'secondary' : 'ghost'}
                  size="sm"
                  aria-pressed={filter === 'review'}
                  onClick={() => setFilter('review')}
                >
                  {t('needsReviewFilter')}{' '}
                  <span className="tabular-nums">{reviewIds.length}</span>
                </Button>
              )}
            </div>
          )}
        </div>
        {browserWorkOnly ? (
          loaded &&
          records.length > 0 && (
            <RecoveryManagement ownerId={ownerId} records={records} all />
          )
        ) : (
          <div className="ml-auto shrink-0">
            <NoteCreateEditor creationLabel={editor('newNote')} />
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive mb-4 text-sm">
          {t('recoveryFailed')}
        </p>
      )}
      {!loaded && (
        <p role="status" className="text-ink-muted mb-4 text-sm">
          {t('loadingWork')}
        </p>
      )}
      {loaded && !error && !displayed.length && (
        <p className="text-ink-muted py-16 text-center font-serif">
          {t(browserWorkOnly ? 'emptyBrowserWork' : 'emptyNotes')}
        </p>
      )}
      <ul
        ref={list}
        className="relative grid grid-cols-[repeat(auto-fill,minmax(min(17rem,100%),1fr))] grid-rows-[masonry] items-start gap-4 pb-8"
      >
        {(loaded || error) && displayed.map(card)}
      </ul>
      {active?.storageFailed && (
        <p role="alert" className="text-destructive text-sm">
          {t('storageFailed')}
        </p>
      )}
    </section>
  )
}
