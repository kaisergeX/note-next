'use client'

import {useEffect, useState, ViewTransition} from 'react'
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
import {Link, usePathname} from '~/i18n/navigation'
import Button, {buttonClass} from '~/components/ui/button'
import NoteTiny from './note-tiny'
import RecoveryStatus from './recovery-status'
import RecoveryManagement from './recovery-management'
import NoteCreateEditor from './note-create'
import {useMasonry} from '~/util/hooks/use-masonry'
import CollectionTitle from './collection-title'
import {withBrowserWorkReturn} from '~/lib/notes/navigation'
import {
  cancelNoteListTransition,
  startNoteListTransition,
} from '~/lib/notes/transitions'
import {NoteListSkeleton} from './note-loading'

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
  const pathname = usePathname()
  const isCollectionRoute =
    pathname === '/eton' || pathname === '/collection/browser-work'
  const {records, loaded, error} = useRecoveryDrafts(ownerId, true, true)
  const [acknowledged, setAcknowledged] = useState<{
    source: Note[]
    notes: Record<string, Note>
  }>({source: notes, notes: {}})
  const storageFailed = usePersistStore(
    (state) => state.noteSession?.storageFailed,
  )
  const [filter, setFilter] = useState<'all' | 'review'>('all')
  const [ordering, setOrdering] = useState<{ownerId: string; ids: string[]}>({
    ownerId,
    ids: [],
  })
  useEffect(() => {
    const keys = new Map<string, object>()
    const saved = (event: Event) => {
      const note = (event as CustomEvent<Note>).detail
      if (note.authorId === ownerId) {
        if (!keys.has(note.id)) keys.set(note.id, {})
        startNoteListTransition(() => {
          setAcknowledged((previous) => ({
            source: notes,
            notes: {
              ...(previous.source === notes ? previous.notes : {}),
              [note.id]: note,
            },
          }))
        }, keys.get(note.id)!)
      }
    }
    window.addEventListener('note-saved', saved)
    return () => {
      window.removeEventListener('note-saved', saved)
      keys.forEach(cancelNoteListTransition)
    }
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
    ordered = [...added, ...ordered]
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
  const layoutKey = displayed.join('|')
  const [settledLayout, setSettledLayout] = useState(layoutKey)
  const layoutChanged = settledLayout !== layoutKey
  useEffect(() => {
    let current = true
    const settle = () => {
      if (current) setSettledLayout(layoutKey)
    }
    void (document.activeViewTransition?.finished ?? Promise.resolve()).then(
      settle,
      settle,
    )
    return () => {
      current = false
    }
  }, [layoutKey])
  const list = useMasonry<HTMLUListElement>(
    loaded || error ? layoutKey : 'loading',
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
      <ViewTransition
        key={id}
        default="none"
        enter={isCollectionRoute && layoutChanged ? 'auto' : 'none'}
        exit={
          isCollectionRoute ? {'note-list': 'auto', default: 'none'} : 'none'
        }
        update={isCollectionRoute && layoutChanged ? 'auto' : 'none'}
      >
        <li className="min-w-0">
          <NoteTiny
            data={data}
            href={href}
            localOnly={!saved || unavailable}
            pendingWork={copies.length > 0}
            notice={unavailable ? t('draftOriginalUnavailable') : undefined}
            actions={
              !saved && groups.length === 1
                ? () => (
                    <RecoveryManagement ownerId={ownerId} records={copies} />
                  )
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
      </ViewTransition>
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
      {!loaded && !error && (
        <div role="status" aria-busy="true">
          <p className="text-ink-muted mb-4 text-sm">{t('loadingWork')}</p>
          <NoteListSkeleton />
        </div>
      )}
      {loaded && !error && !displayed.length && (
        <p className="text-ink-muted py-16 text-center font-serif">
          {t(browserWorkOnly ? 'emptyBrowserWork' : 'emptyNotes')}
        </p>
      )}
      <ul
        ref={list}
        className="note-grid relative grid grid-rows-[masonry] items-start gap-4 pb-8"
      >
        {(loaded || error) && displayed.map(card)}
      </ul>
      {storageFailed && (
        <p role="alert" className="text-destructive text-sm">
          {t('storageFailed')}
        </p>
      )}
    </section>
  )
}
