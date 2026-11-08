'use client'

import {useEffect, useMemo, useRef, useState, ViewTransition} from 'react'
import {useTranslations} from 'next-intl'
import {IconArrowLeft} from '@tabler/icons-react'
import {cn} from 'cn'
import {useRecoveryDrafts} from '~/lib/notes/use-recovery-drafts'
import {
  groupNoteRecovery,
  groupRecoveryDrafts,
} from '~/lib/notes/recovery-copies'
import {usePersistStore} from '~/store'
import {useMobileNoteView} from '~/lib/notes/mobile'
import {Link, usePathname, useRouter} from '~/i18n/navigation'
import Button, {buttonClass} from '~/components/ui/button'
import NoteTiny from './note-tiny'
import LoadingIndicator from '~/components/ui/loading-indicator'
import RecoveryStatus from './recovery-status'
import RecoveryManagement from './recovery-management'
import NoteCreateEditor from './note-create'
import NoteMasonry from './note-masonry'
import CollectionTitle from './collection-title'
import {withBrowserWorkReturn} from '~/lib/notes/navigation'
import {NoteListSkeleton} from './note-loading'
import {notePreview, type NotePage} from '~/lib/notes/pages'
import {useNotePages} from '~/lib/notes/use-note-pages'
import {
  useNoteCollectionState,
  useNoteListPosition,
} from './note-query-provider'
import {useNoteSearch} from '~/lib/notes/use-note-search'
import {foldSearchText, searchableNoteText} from '~/lib/notes/search'
import {
  reconcileNoteSearch,
  pendingNoteAcknowledgements,
  type SearchDisplayOverride,
} from '~/lib/notes/search-reconciliation'
import {NoteSearchRequestError} from '~/lib/notes/search-client'
import NoteSearchControls from './note-search-controls'

export default function NotesCollection({
  ownerId,
  initialPage,
  browserWorkOnly = false,
}: {
  ownerId: string
  initialPage?: NotePage
  browserWorkOnly?: boolean
}) {
  const t = useTranslations('note.recovery')
  const editor = useTranslations('note.editor')
  const searchText = useTranslations('note.search')
  const router = useRouter()
  const [collection, setCollection] = useNoteCollectionState()
  const {filter, acknowledged} = collection
  const setFilter = (filter: 'all' | 'review') =>
    setCollection((state) => ({...state, filter}))
  const [composing, setComposing] = useState(false)
  const search = useNoteSearch(
    ownerId,
    browserWorkOnly ? '' : collection.search,
    composing,
  )
  const searching = !browserWorkOnly && search.active
  const searchField = useRef<HTMLDivElement>(null)
  const mobile = useMobileNoteView()
  const pathname = usePathname()
  const isCollectionRoute =
    pathname === '/eton' || pathname === '/collection/browser-work'
  const {records, loaded, error} = useRecoveryDrafts(ownerId, true, true)
  const {query, identities, notes, pagesSettled} = useNotePages(
    ownerId,
    initialPage,
    records,
  )
  const listQuery = searching ? search.query : query
  const listSettled = searching ? search.pagesSettled : pagesSettled
  const reconciledAt =
    isCollectionRoute &&
    listSettled &&
    listQuery.isSuccess &&
    !listQuery.isFetching
      ? listQuery.dataUpdatedAt
      : 0
  const pendingAcknowledged = pendingNoteAcknowledgements(
    acknowledged,
    reconciledAt,
  )
  useEffect(() => {
    if (!reconciledAt) return
    setCollection((previous) => {
      const pending = pendingNoteAcknowledgements(
        previous.acknowledged,
        reconciledAt,
      )
      return Object.keys(pending).length ===
        Object.keys(previous.acknowledged).length
        ? previous
        : {...previous, acknowledged: pending}
    })
  }, [reconciledAt, setCollection])
  const draftSearchText = useMemo(
    () =>
      new Map(
        records.map((record) => [
          record.id,
          {
            title: searchableNoteText(record.draft.title),
            body: record.baseline.isEncrypted
              ? ''
              : searchableNoteText(record.draft.content),
          },
        ]),
      ),
    [records],
  )
  const acknowledgedSearchText = useMemo(
    () =>
      new Map(
        Object.values(acknowledged).map(({note}) => [
          note.id,
          {
            title: searchableNoteText(note.title),
            body: note.isEncrypted ? '' : searchableNoteText(note.content),
          },
        ]),
      ),
    [acknowledged],
  )
  const sentinel = useRef<HTMLDivElement>(null)
  const positionRef = useNoteListPosition()
  const [returnId, setReturnId] = useState<string>()
  const storageFailed = usePersistStore(
    (state) => state.noteSession?.storageFailed,
  )
  const [ordering, setOrdering] = useState<{ownerId: string; ids: string[]}>({
    ownerId,
    ids: [],
  })
  const server = new Map(
    notes
      .filter((note) => note.authorId === ownerId)
      .map((note) => [note.id, note]),
  )
  for (const note of searching ? search.notes : []) {
    const current = server.get(note.id)
    if (
      note.authorId === ownerId &&
      (!current || new Date(note.updatedAt) >= new Date(current.updatedAt))
    )
      server.set(note.id, note)
  }
  const currentAcknowledged = Object.values(pendingAcknowledged)
    .map(({note}) => note)
    .filter((note) => {
      const current = server.get(note.id)
      return (
        note.authorId === ownerId &&
        (!current || new Date(note.updatedAt) >= new Date(current.updatedAt))
      )
    })
  for (const note of currentAcknowledged) {
    if (note.authorId !== ownerId) continue
    const current = server.get(note.id)
    if (!current || new Date(note.updatedAt) >= new Date(current.updatedAt))
      server.set(note.id, {
        ...notePreview(note),
        ...(current?.createdOrder ? {createdOrder: current.createdOrder} : {}),
      })
  }
  const local = groupNoteRecovery(records)
  for (const [id, note] of server) if (note.pendingDeleteAt) server.delete(id)
  const overrides: SearchDisplayOverride[] = currentAcknowledged.map(
    (note) => ({
      ...note,
      ownerId,
      deleted: Boolean(note.pendingDeleteAt),
      searchText: acknowledgedSearchText.get(note.id),
    }),
  )
  for (const note of server.values())
    if (note.isEncrypted)
      overrides.push({
        id: note.id,
        ownerId,
        title: note.title,
        content: null,
        isEncrypted: true,
      })
  for (const [id, copies] of local) {
    const groups = groupRecoveryDrafts(copies)
    if (groups.length !== 1) continue
    const record = groups[0].record
    overrides.push({
      id,
      ownerId,
      ...record.draft,
      isEncrypted:
        server.get(id)?.isEncrypted ??
        record.baseline.isEncrypted ??
        Boolean(record.noteId || record.baseline.id),
      searchText: draftSearchText.get(record.id),
    })
  }
  const matches = reconcileNoteSearch(
    ownerId,
    collection.search,
    search.notes,
    overrides,
  )
  const searchPending =
    search.pending || (!loaded && !error) || identities.isFetching
  const present = new Set([...server.keys(), ...local.keys()])
  let ordered = ordering.ownerId === ownerId ? ordering.ids : []
  const known = new Set(ordered)
  const added = [...present].filter((id) => !known.has(id))
  if (added.length || ordering.ownerId !== ownerId) {
    const created = (id: string) => {
      const note = server.get(id)
      const record = local.get(id)?.[0]
      return (
        note?.createdOrder ??
        new Date(
          note?.createdAt ??
            record?.baseline.createdAt ??
            record?.updatedAt ??
            0,
        )
          .toISOString()
          .replace('Z', '000Z')
      )
    }
    ordered = [...ordered]
    for (const id of added) {
      const position = ordered.findIndex(
        (other) =>
          created(id) > created(other) ||
          (created(id) === created(other) && id > other),
      )
      ordered.splice(position < 0 ? ordered.length : position, 0, id)
    }
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
  const filtered = browserWorkOnly
    ? ids.filter((id) => local.has(id))
    : hasFilters && filter === 'review'
      ? reviewIds
      : ids
  const displayed = searching
    ? filtered.filter((id) => matches.has(id))
    : filtered
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
  const list = useRef<HTMLUListElement>(null)
  const restored = useRef(false)
  const restorePosition = () => {
    if (!isCollectionRoute) {
      restored.current = false
      return
    }
    if (restored.current || (!loaded && !error)) return
    const previous = positionRef.current
    if (!previous || previous.browserWorkOnly !== browserWorkOnly) {
      restored.current = true
      return
    }
    // Opening can remeasure the list before navigation commits. Keep its return
    // marker until the provider has observed the actual editor route.
    if (!previous.departed) return
    if (
      (previous.search ?? '') !==
      (searching ? foldSearchText(collection.search) : '')
    ) {
      positionRef.current = undefined
      restored.current = true
      return
    }
    if (
      searching &&
      !matches.has(previous.id) &&
      (overrides.some((note) => note.id === previous.id) ||
        (!searchPending && search.complete))
    ) {
      positionRef.current = undefined
      restored.current = true
      searchField.current?.querySelector('input')?.focus()
      return
    }
    setReturnId(previous.id)
    // A mobile route can first mount cached hits, then replace them with the
    // post-save response. Restore focus after that reconciliation has settled.
    if (searching && searchPending) return
    const anchor = list.current?.querySelector<HTMLAnchorElement>(
      `a[data-note-id="${previous.id}"]`,
    )
    if (anchor) {
      restored.current = true
      positionRef.current = undefined
      window.scrollBy({
        top: anchor.getBoundingClientRect().top - previous.top,
        behavior: 'instant',
      })
      anchor.focus({preventScroll: true})
    }
  }
  const canLoad =
    !browserWorkOnly &&
    (loaded || error) &&
    (searching || filter === 'all') &&
    listQuery.hasNextPage
  const {isFetching, isError, fetchNextPage} = listQuery
  useEffect(() => {
    const target = sentinel.current
    if (
      !target ||
      !canLoad ||
      !listSettled ||
      isFetching ||
      isError ||
      !isCollectionRoute
    )
      return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void fetchNextPage()
      },
      {rootMargin: '600px'},
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [
    canLoad,
    listSettled,
    isFetching,
    isError,
    fetchNextPage,
    isCollectionRoute,
  ])
  const card = (id: string) => {
    const saved = server.get(id)
    const copies = local.get(id) ?? []
    const groups = groupRecoveryDrafts(copies)
    const record = groups[0]?.record
    const ambiguous = groups.length > 1
    const review = ambiguous || Boolean(record?.conflict)
    const unavailable = Boolean(record?.unavailable)
    // The saved page may not be loaded yet. Existing-note drafts still open
    // their saved editor (which fetches the complete document independently).
    const savedIdentity = Boolean(
      saved ||
      (!identities.isSuccess &&
        !unavailable &&
        copies.some(
          (copy) => copy.noteId || copy.baseline.id || copy.conflict?.id,
        )),
    )
    const preview =
      !ambiguous && record
        ? {
            ...saved,
            ...record.baseline,
            ...record.draft,
            id,
            authorId: ownerId,
            isEncrypted:
              saved?.isEncrypted ??
              record.baseline.isEncrypted ??
              Boolean(record.noteId || record.baseline.id),
          }
        : saved
    // Multiple new-note versions have no server preview. Keep their common
    // identity and open a chooser rather than selecting a version by time.
    const data = preview ?? {id, title: null, content: null, theme: null}
    const href = browserWorkOnly
      ? withBrowserWorkReturn(
          savedIdentity
            ? `/full/eton/${id}${review ? '?review=1' : ''}`
            : `/full/eton/recover/${record!.id}${review ? '?review=1' : ''}`,
          true,
        )
      : savedIdentity
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
        <>
          <NoteTiny
            data={data}
            snippet={searching ? matches.get(id) : undefined}
            onOpen={(anchor) => {
              restored.current = false
              setReturnId(id)
              positionRef.current = {
                id,
                top: anchor.getBoundingClientRect().top,
                browserWorkOnly,
                search: searching ? foldSearchText(collection.search) : '',
              }
            }}
            href={href}
            localOnly={!savedIdentity || unavailable}
            pendingWork={copies.length > 0}
            notice={unavailable ? t('draftOriginalUnavailable') : undefined}
            actions={
              !savedIdentity && groups.length === 1
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
        </>
      </ViewTransition>
    )
  }
  return (
    <section aria-label={t(browserWorkOnly ? 'browserWorkTitle' : 'notesHome')}>
      {!browserWorkOnly && (
        <div ref={searchField}>
          <NoteSearchControls
            value={collection.search}
            onChange={(value) =>
              setCollection((state) => ({...state, search: value}))
            }
            onCompositionChange={setComposing}
            pending={searchPending}
            count={displayed.length}
            complete={search.complete && !searchPending}
            error={
              search.error
                ? search.error instanceof NoteSearchRequestError
                  ? search.error.code
                  : 'failed'
                : null
            }
            onRetry={() =>
              search.error instanceof NoteSearchRequestError &&
              search.error.code === 'account_changed'
                ? router.refresh()
                : search.query.isFetchNextPageError
                  ? void search.query.fetchNextPage()
                  : void search.query.refetch()
            }
          />
        </div>
      )}
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
        <div aria-busy="true">
          <LoadingIndicator label={t('loadingWork')} className="mb-4" />
          <NoteListSkeleton />
        </div>
      )}
      {loaded && !error && !searching && !displayed.length && (
        <p className="text-ink-muted py-16 text-center font-serif">
          {t(browserWorkOnly ? 'emptyBrowserWork' : 'emptyNotes')}
        </p>
      )}
      <NoteMasonry
        key={searching ? 'search' : 'notes'}
        ids={loaded || error ? displayed : []}
        renderCard={card}
        listRef={list}
        pinnedId={returnId}
        onLayout={restorePosition}
      />
      {identities.isError && (
        <div role="alert" className="text-destructive mb-4 text-sm">
          <p>{t('loadFailed')}</p>
          <Button variant="secondary" onClick={() => void identities.refetch()}>
            {t('retryLoad')}
          </Button>
        </div>
      )}
      {!browserWorkOnly &&
        (!searching || !listQuery.isError) &&
        (searching || filter === 'all') &&
        (canLoad ||
          listQuery.isError ||
          !listSettled ||
          (listQuery.data?.pages.length ?? 0) > 1) && (
          <div
            ref={sentinel}
            className="flex min-h-28 flex-col items-center gap-3 pb-8"
          >
            {listQuery.isError && (
              <p role="alert" className="text-destructive text-sm">
                {t('loadFailed')}
              </p>
            )}
            <div role="status" aria-live="polite">
              {listQuery.isFetchingNextPage && (
                <LoadingIndicator label={t('loadingNotes')} />
              )}
              {!searching &&
                !listQuery.hasNextPage &&
                listSettled &&
                !listQuery.isError && (
                  <p className="text-ink-muted text-sm">
                    {t('allNotesLoaded')}
                  </p>
                )}
            </div>
            {(listQuery.hasNextPage || listQuery.isError || !listSettled) && (
              <Button
                variant="secondary"
                disabled={listQuery.isFetching || !listSettled}
                onClick={() => {
                  if (listQuery.isFetchNextPageError || !listQuery.isError)
                    void listQuery.fetchNextPage()
                  else void listQuery.refetch()
                }}
              >
                {searching
                  ? searchText(listQuery.isError ? 'retry' : 'loadMore')
                  : t(listQuery.isError ? 'retryLoad' : 'loadMore')}
              </Button>
            )}
          </div>
        )}
      {storageFailed && (
        <p role="alert" className="text-destructive text-sm">
          {t('storageFailed')}
        </p>
      )}
    </section>
  )
}
