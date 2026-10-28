'use client'

import {useEffect, useId, useRef, useState} from 'react'
import {
  IconArrowLeft,
  IconDotsVertical,
  IconFiles,
  IconInfoCircle,
  IconSearch,
} from '@tabler/icons-react'
import {useLocale, useTranslations} from 'next-intl'
import {
  clearDraftBatch,
  exportDrafts,
  type RecoveryDraft,
} from '~/lib/notes/drafts'
import {Dialog} from '@kaiverse/k/ui'
import {noteText} from '~/lib/notes/text'
import {getNoteSync} from '~/lib/notes/session-sync'
import {meaningfulContent} from '~/lib/notes/sync'
import {useRecoveryDrafts} from '~/lib/notes/use-recovery-drafts'
import {groupRecoveryDrafts} from '~/lib/notes/recovery-copies'
import {Link, useRouter} from '~/i18n/navigation'
import {isMobileNoteView} from '~/lib/notes/mobile'
import type {Note} from '~/db/schema/notes'
import Button, {buttonClass} from '~/components/ui/button'
import MenuCustom from '~/components/ui/menu'
import PopoverBase from '~/components/ui/popover'
import {Input} from '~/components/ui/input'
import ConfirmationDialog from '~/components/ui/confirmation-dialog'
import NoteCard, {NoteCardFooter, NoteCardSummary} from './note-card'
import NoteDialog from './note-dialog'
import CollectionTitle from './collection-title'
import {useNoteSession} from './use-note-session'

function RecoveryEditor({
  record,
  note,
  onClose,
}: {
  record: RecoveryDraft
  note?: Note
  onClose: () => void
}) {
  const session = useNoteSession(note, true, record)
  if (!session.ready) return null
  return (
    <NoteDialog
      open
      type={note ? 'update' : 'create'}
      loading={session.pending}
      onClose={() => void session.saveAndLeave(onClose)}
      onMoveToTrash={() => void session.trashAndLeave(onClose)}
    />
  )
}

export default function RecoveryDrafts({ownerId}: {ownerId: string}) {
  const router = useRouter()
  const t = useTranslations('note.recovery')
  const locale = useLocale()
  const {
    records: visible,
    groups,
    error: storageError,
    loaded,
  } = useRecoveryDrafts(ownerId)
  const [selected, setSelected] = useState<{
    record: RecoveryDraft
    note?: Note
  }>()
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [discard, setDiscard] = useState<string>()
  const [query, setQuery] = useState('')
  const [discardAll, setDiscardAll] = useState<RecoveryDraft[]>()
  const [bulkNotice, setBulkNotice] = useState(false)
  const bulkTitleId = useId()
  const bulkDescriptionId = useId()
  const discardAction = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (discard) discardAction.current?.focus()
  }, [discard])
  const open = async (record: RecoveryDraft) => {
    setBusy(true)
    try {
      // Secure the editor already open in an intercepted route before switching.
      const current = getNoteSync()
      if (current?.dirty && !(await current.persist())) {
        setError(true)
        return
      }
      if (isMobileNoteView()) {
        router.push(`/full/eton/recover/${record.id}`)
        return
      }
      if (!record.noteId) {
        setSelected({record})
        return
      }
      const response = await fetch(`/api/note/${record.noteId}`, {
        cache: 'no-store',
      })
      if (response.status === 404)
        setSelected({record: {...record, unavailable: true}})
      else if (response.ok)
        setSelected({record, note: (await response.json()) as Note})
      else setError(true)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  const search = query.trim().toLocaleLowerCase(locale)
  const filtered = groups.filter(
    ({record}) =>
      !search ||
      `${noteText(record.draft.title)} ${noteText(record.draft.content)}`
        .toLocaleLowerCase(locale)
        .includes(search),
  )
  const dateFormat = new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  })
  return (
    <section className="w-full pb-8" aria-label={t('draftsPageTitle')}>
      <header className="mb-4 flex min-h-10 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href="/eton"
              className={buttonClass({variant: 'ghost', iconOnly: true})}
              aria-label={t('backToNotes')}
            >
              <IconArrowLeft size={18} aria-hidden />
            </Link>
            <CollectionTitle
              title={t('draftsPageTitle')}
              count={loaded ? groups.length : undefined}
              countLabel={t('draftCount', {count: groups.length})}
            />
            <PopoverBase
              anchor="bottom-end"
              trigger={<IconInfoCircle size={18} aria-hidden />}
              triggerAriaLabel={t('draftsInfo')}
              triggerClassName={buttonClass({variant: 'ghost', iconOnly: true})}
              className="border-hairline bg-paper-raised text-ink shadow-sheet max-w-72 rounded-lg border p-3 text-sm"
            >
              <p>{t('draftsDescription')}</p>
            </PopoverBase>
          </div>
        </div>
        {loaded && visible.length > 0 && (
          <div className="ml-auto flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || storageError}
              onClick={() => exportDrafts(visible)}
            >
              {t('exportAllDrafts')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={busy || storageError}
              onClick={() => {
                setBulkNotice(false)
                setDiscardAll([...visible])
              }}
            >
              {t('discardAllDrafts')}
            </Button>
          </div>
        )}
      </header>
      {loaded && visible.length > 0 && (
        <label className="relative mb-4 block w-full sm:w-72">
          <span className="sr-only">{t('searchDrafts')}</span>
          <IconSearch
            size={18}
            aria-hidden
            className="text-ink-muted pointer-events-none absolute top-3 left-3"
          />
          <Input
            type="search"
            className="pl-10"
            placeholder={t('searchDrafts')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      )}
      {bulkNotice && (
        <p role="alert" className="text-warning mb-3 text-sm">
          {t('draftsChanged')}
        </p>
      )}
      {(error || storageError) && (
        <p role="alert" className="text-destructive px-2 pb-3 text-sm">
          {t('recoveryFailed')}
        </p>
      )}
      {!loaded && (
        <p role="status" className="text-ink-muted py-6 text-sm">
          {t('loadingDrafts')}
        </p>
      )}
      {loaded && !visible.length && !error && !storageError && (
        <div className="border-hairline flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
          <IconFiles size={32} aria-hidden className="text-ink-muted" />
          <h2 className="text-lg font-semibold">{t('noDrafts')}</h2>
          <p className="text-ink-muted max-w-prose text-sm">
            {t('noDraftsHelp')}
          </p>
        </div>
      )}
      {loaded && visible.length > 0 && !filtered.length && (
        <div className="py-12 text-center">
          <p className="text-ink-muted">{t('noMatchingDrafts')}</p>
          <Button variant="link" onClick={() => setQuery('')}>
            {t('clearSearch')}
          </Button>
        </div>
      )}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(17rem,100%),1fr))] grid-rows-[masonry] gap-4 pb-16">
        {filtered.map(({record, copies}) => {
          const hasTitle = Boolean(noteText(record.draft.title))
          const title = hasTitle ? noteText(record.draft.title) : t('untitled')
          return (
            <li key={record.id} className="min-w-0">
              <NoteCard
                theme={record.draft.theme}
                className="flex h-full flex-col"
              >
                <Link
                  href={`/full/eton/recover/${record.id}`}
                  className="focus-visible:outline-accent block flex-1 rounded-t-lg p-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                  aria-label={t('openNamedDraft', {title})}
                  aria-disabled={busy || undefined}
                  onClick={(event) => {
                    if (busy) {
                      event.preventDefault()
                      return
                    }
                    if (
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return
                    event.preventDefault()
                    void open(record)
                  }}
                >
                  {meaningfulContent(record.draft) ? (
                    <NoteCardSummary
                      title={hasTitle ? record.draft.title : null}
                      content={record.draft.content}
                      theme={record.draft.theme}
                    />
                  ) : (
                    <p className="text-ink-muted font-sans text-sm italic">
                      {t('emptyDraft')}
                    </p>
                  )}
                </Link>
                {(record.conflict || record.unavailable) && (
                  <p className="text-warning px-4 pb-2 text-sm">
                    {t(
                      record.unavailable
                        ? 'draftOriginalUnavailable'
                        : 'draftConflict',
                    )}
                  </p>
                )}
                <NoteCardFooter
                  actions={
                    <MenuCustom
                      className={buttonClass({
                        variant: 'ghost',
                        iconOnly: true,
                      })}
                      ariaLabel={t('draftActions', {title})}
                      items={[
                        {
                          type: 'action',
                          label: t('export'),
                          onSelect: () => exportDrafts(copies),
                        },
                        {
                          type: 'action',
                          label: t('discard'),
                          destructive: true,
                          onSelect: () => setDiscard(record.id),
                        },
                      ]}
                    >
                      <IconDotsVertical size={18} aria-hidden />
                    </MenuCustom>
                  }
                >
                  <time
                    dateTime={new Date(record.updatedAt).toISOString()}
                    aria-label={t('savedOnDeviceAt', {
                      time: dateFormat.format(record.updatedAt),
                    })}
                  >
                    {dateFormat.format(record.updatedAt)}
                  </time>
                </NoteCardFooter>
                {discard === record.id && (
                  <div className="border-destructive/40 bg-paper-raised w-full rounded-b-lg border-t px-3 py-3">
                    <p className="text-warning text-sm">
                      {t('discardDraftWarning')}
                    </p>
                    <Button
                      ref={discardAction}
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        void clearDraftBatch(ownerId, copies)
                          .then((result) => {
                            setBulkNotice(result.newer > 0)
                            setDiscard(undefined)
                          })
                          .catch(() => setError(true))
                      }
                    >
                      {t('confirmDiscard')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDiscard(undefined)}
                    >
                      {t('cancel')}
                    </Button>
                  </div>
                )}
              </NoteCard>
            </li>
          )
        })}
      </ul>
      <ConfirmationDialog
        open={!!discardAll}
        busy={busy}
        labelledBy={bulkTitleId}
        describedBy={bulkDescriptionId}
        onRequestClose={() => setDiscardAll(undefined)}
        className="p-0"
      >
        <Dialog.Header>
          <Dialog.Title id={bulkTitleId} className="text-base font-semibold">
            {t('discardAllTitle')}
          </Dialog.Title>
        </Dialog.Header>
        <Dialog.Content className="pt-0 text-sm">
          <p id={bulkDescriptionId}>
            {t('discardAllBody', {
              count: groupRecoveryDrafts(discardAll ?? []).length,
            })}
          </p>
          {error && (
            <p role="alert" className="text-destructive mt-2">
              {t('recoveryFailed')}
            </p>
          )}
        </Dialog.Content>
        <Dialog.Footer className="justify-end gap-2 pt-0">
          <Button
            variant="secondary"
            data-cancel
            disabled={busy}
            onClick={() => setDiscardAll(undefined)}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              if (!discardAll) return
              setBusy(true)
              try {
                const result = await clearDraftBatch(ownerId, discardAll)
                setBulkNotice(result.newer > 0)
                setDiscardAll(undefined)
                setError(false)
              } catch {
                setError(true)
              } finally {
                setBusy(false)
              }
            }}
          >
            {t('discardAllDrafts')}
          </Button>
        </Dialog.Footer>
      </ConfirmationDialog>
      {selected && (
        <RecoveryEditor
          key={selected.record.id}
          {...selected}
          onClose={() => setSelected(undefined)}
        />
      )}
    </section>
  )
}
