'use client'

import {useEffect, useRef, useState, type ReactNode} from 'react'
import {useTranslations} from 'next-intl'
import {cn} from 'cn'
import {IconArrowsDiff, IconEye} from '@tabler/icons-react'
import Button from '~/components/ui/button'
import LoadingIndicator from '~/components/ui/loading-indicator'
import {Badge} from '~/components/ui/badge'
import type {Note, NoteTheme} from '~/db/schema/notes'
import type {RecoveryDraft} from '~/lib/notes/drafts'
import {useMobileNoteView} from '~/lib/notes/mobile'
import {snapshot, type NoteSnapshot} from '~/lib/notes/sync'
import type {NoteStoreState} from '~/types/note'
import RecoveryManagement from './recovery-management'
import NoteReadOnly from './trash/note-read-only'
import NoteCard from './note-card'
import {NoteThemePicker} from './note-theme-picker'
import NoteVersionDiff from './note-version-diff'

export default function NoteConflictReview({
  titleId,
  descriptionId,
  remote,
  draft,
  record,
  session,
  busy,
  resolutionPending,
  writing,
  onClose,
  onResolve,
  onRefresh,
  onCheckpoint,
  onRetryResolution,
  onEditCopy,
  onDiscardCopy,
  onExport,
}: {
  titleId: string
  descriptionId: string
  remote: Note
  draft: NoteSnapshot
  record?: RecoveryDraft
  session?: NoteStoreState['noteSession']
  busy: boolean
  resolutionPending: boolean
  writing: ReactNode
  onClose: () => void
  onResolve: (choice: 'both' | 'mine' | 'saved') => void
  onRefresh: () => void
  onCheckpoint: () => void
  onRetryResolution: () => void
  onEditCopy: () => void
  onDiscardCopy: () => Promise<void>
  onExport: () => void
}) {
  const t = useTranslations('note.recovery')
  const [showChanges, setShowChanges] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [side, setSide] = useState<'mine' | 'saved'>('mine')
  const mobile = useMobileNoteView()
  const tabs = useRef<Record<'mine' | 'saved', HTMLButtonElement | null>>({
    mine: null,
    saved: null,
  })
  const discardHeading = useRef<HTMLHeadingElement>(null)
  const savedAction = useRef<HTMLButtonElement>(null)
  const previousDiscard = useRef(false)
  const editedCopy = Boolean(record?.editedCopyOf)
  const resolutionDisabled =
    busy ||
    resolutionPending ||
    session?.checkingRemote ||
    session?.remoteCheckFailed
  useEffect(() => {
    if (discard) discardHeading.current?.focus()
    else if (previousDiscard.current) savedAction.current?.focus()
    previousDiscard.current = discard
  }, [discard])

  return (
    <>
      <header className="shrink-0 px-3 pt-3 sm:px-6 sm:pt-6 sm:pb-3">
        <h2 id={titleId} tabIndex={-1} className="text-lg font-semibold">
          {t('conflictTitle')}
        </h2>
        <p
          id={descriptionId}
          className="text-ink-muted mt-1 text-xs sm:mt-2 sm:text-sm"
        >
          {t('conflictDescription')}
        </p>
        {session?.storageFailed && (
          <div
            role="alert"
            className="text-destructive mt-2 flex flex-wrap items-center gap-2 text-sm"
          >
            <p>{t('storageFailed')}</p>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={onCheckpoint}
            >
              {t('retry')}
            </Button>
          </div>
        )}
        {session?.checkingRemote && (
          <LoadingIndicator
            label={t('checkingSaved')}
            className="mt-2 text-xs"
          />
        )}
        {session?.remoteCheckFailed && (
          <div
            role="alert"
            className="text-destructive mt-2 flex flex-wrap items-center gap-2 text-xs"
          >
            <p>{t('refreshFailed')}</p>
            <Button size="sm" variant="secondary" onClick={onRefresh}>
              {t('retry')}
            </Button>
          </div>
        )}
        {resolutionPending &&
          !session?.storageFailed &&
          !session?.remoteCheckFailed &&
          !session?.checkingRemote &&
          session?.syncStatus !== 'saving' && (
            <div
              role="alert"
              className="text-destructive mt-2 flex flex-wrap items-center gap-2 text-xs"
            >
              <p>{t('failed')}</p>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={onRetryResolution}
              >
                {t('retry')}
              </Button>
            </div>
          )}
        <section className="border-hairline bg-ink-tint mt-3 flex shrink-0 items-center justify-between gap-3 rounded-md border px-3 py-2 sm:mt-4 sm:rounded-lg sm:p-4">
          <div>
            <h3 className="text-sm font-semibold sm:text-base">
              {t('keepBothHeading')}
            </h3>
            <p className="text-ink mt-1 hidden text-sm sm:block">
              {t('keepBothHelp')}
            </p>
            <p className="text-ink mt-1 text-xs sm:hidden">
              {t('keepBothShortHelp')}
            </p>
          </div>
          <Button
            className="shrink-0"
            disabled={resolutionDisabled}
            onClick={() => onResolve('both')}
          >
            {t('keepBoth')}
          </Button>
        </section>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            variant={showChanges ? 'secondary' : 'primary'}
            className="h-auto min-h-10 whitespace-normal"
            aria-pressed={showChanges}
            onClick={() => setShowChanges((value) => !value)}
          >
            {showChanges ? (
              <IconEye size={18} aria-hidden className="shrink-0" />
            ) : (
              <IconArrowsDiff size={18} aria-hidden className="shrink-0" />
            )}
            {t(showChanges ? 'diff.showPreviews' : 'diff.showChanges')}
          </Button>
          {showChanges && (
            <p className="text-ink-muted flex flex-wrap gap-3 text-xs">
              <span className="decoration-success underline decoration-2 underline-offset-2">
                {t('diff.added')}
              </span>
              <span className="decoration-destructive line-through decoration-2">
                {t('diff.removed')}
              </span>
            </p>
          )}
        </div>
        {mobile && (
          <div
            className="border-hairline mt-2 flex border-b"
            role="tablist"
            aria-label={t('versionTabs')}
          >
            {(['mine', 'saved'] as const).map((value) => (
              <Button
                key={value}
                variant="ghost"
                role="tab"
                id={`${titleId}-tab-${value}`}
                aria-controls={`${titleId}-panel-${value}`}
                aria-selected={side === value}
                tabIndex={side === value ? 0 : -1}
                ref={(element) => {
                  tabs.current[value] = element
                }}
                className="text-ink-muted aria-selected:border-ink aria-selected:text-ink h-auto min-h-10 min-w-0 flex-1 rounded-none border-x-0 border-t-0 border-b-2 px-2 whitespace-normal"
                onClick={() => setSide(value)}
                onKeyDown={(event) => {
                  const next =
                    event.key === 'Home'
                      ? 'mine'
                      : event.key === 'End'
                        ? 'saved'
                        : event.key === 'ArrowLeft' ||
                            event.key === 'ArrowRight'
                          ? value === 'mine'
                            ? 'saved'
                            : 'mine'
                          : null
                  if (!next) return
                  event.preventDefault()
                  setSide(next)
                  tabs.current[next]?.focus()
                }}
              >
                {t(value === 'mine' && editedCopy ? 'editedCopy' : value)}
              </Button>
            ))}
          </div>
        )}
      </header>
      <div className="flex min-h-0 flex-1 flex-col sm:px-6 sm:pb-6">
        <div className="grid min-h-0 flex-1 items-stretch sm:mt-4 sm:grid-cols-2">
          <section
            id={`${titleId}-panel-mine`}
            role={mobile ? 'tabpanel' : undefined}
            aria-labelledby={mobile ? `${titleId}-tab-mine` : undefined}
            hidden={mobile && side !== 'mine'}
            className={cn(
              'flex min-h-0 min-w-0 flex-col overflow-hidden sm:pr-6',
              side === 'saved' && 'max-sm:hidden',
            )}
          >
            <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 px-3 pt-2 sm:px-0 sm:pt-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h3 className="hidden font-semibold sm:block">{t('mine')}</h3>
                {editedCopy && (
                  <Badge aria-label={t('editedCopyOrigin')}>
                    {t('editedCopy')}
                  </Badge>
                )}
              </div>
              {editedCopy ? (
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <NoteThemePicker disabled={busy} size="md" />
                  <RecoveryManagement
                    ownerId={record!.ownerId}
                    records={[record!]}
                    onDiscard={onDiscardCopy}
                  />
                </div>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={resolutionDisabled}
                  onClick={onEditCopy}
                >
                  {t('editCopy')}
                </Button>
              )}
            </div>
            <div
              role={showChanges ? 'region' : undefined}
              aria-label={showChanges ? t('mine') : undefined}
              tabIndex={showChanges ? 0 : undefined}
              style={{overflowAnchor: 'none'}}
              className={cn(
                'focus-visible:outline-accent flex min-h-0 flex-1 flex-col overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2 sm:my-4',
                showChanges ? 'overflow-y-auto' : 'overflow-hidden',
              )}
            >
              {editedCopy && (
                <div
                  hidden={showChanges}
                  className={cn(
                    'min-h-0 flex-1 flex-col p-3 sm:p-0',
                    showChanges ? 'hidden' : 'flex',
                  )}
                >
                  <NoteCard
                    theme={draft?.theme}
                    className="flex min-h-0 flex-1 flex-col overflow-hidden"
                  >
                    <div
                      role="region"
                      aria-label={t('mine')}
                      tabIndex={0}
                      style={{overflowAnchor: 'none'}}
                      className="focus-visible:outline-accent flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain rounded-lg focus-visible:outline-2 focus-visible:-outline-offset-2 [&_[data-editor-toolbar]]:rounded-t-lg"
                    >
                      {writing}
                    </div>
                  </NoteCard>
                </div>
              )}
              {showChanges ? (
                <NoteVersionDiff
                  saved={snapshot(remote)}
                  mine={snapshot(draft)}
                  side="mine"
                />
              ) : !editedCopy ? (
                <VersionPreview
                  label={t('mine')}
                  theme={draft?.theme ?? null}
                  title={draft?.title ?? null}
                  content={draft?.content ?? null}
                />
              ) : null}
            </div>
            <div className="bg-paper-raised sm:border-hairline shrink-0 px-3 pb-2 sm:px-0 sm:pb-0">
              <p className="text-ink-muted mb-2 text-xs sm:mb-3 sm:text-sm">
                {t('useMineHelp')}
              </p>
              <Button
                className="h-auto min-h-10 w-full whitespace-normal"
                variant="secondary"
                disabled={resolutionDisabled}
                onClick={() => onResolve('mine')}
              >
                {t(editedCopy ? 'useThisVersion' : 'useMine')}
              </Button>
            </div>
          </section>
          <section
            id={`${titleId}-panel-saved`}
            role={mobile ? 'tabpanel' : undefined}
            aria-labelledby={mobile ? `${titleId}-tab-saved` : undefined}
            hidden={mobile && side !== 'saved'}
            className={cn(
              'sm:border-hairline flex min-h-0 min-w-0 flex-col overflow-hidden sm:border-l sm:pl-6',
              side === 'mine' && 'max-sm:hidden',
            )}
          >
            <h3 className="hidden min-h-10 items-center font-semibold sm:flex">
              {t('saved')}
            </h3>
            <div
              role={showChanges ? 'region' : undefined}
              aria-label={showChanges ? t('saved') : undefined}
              tabIndex={showChanges ? 0 : undefined}
              style={{overflowAnchor: 'none'}}
              className={cn(
                'focus-visible:outline-accent flex min-h-0 flex-1 flex-col overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2 sm:my-4',
                showChanges ? 'overflow-y-auto' : 'overflow-hidden',
              )}
            >
              {showChanges ? (
                <NoteVersionDiff
                  saved={snapshot(remote)}
                  mine={snapshot(draft)}
                  side="saved"
                />
              ) : (
                <VersionPreview
                  label={t('saved')}
                  theme={remote.theme}
                  title={remote.title}
                  content={remote.content}
                />
              )}
            </div>
            {discard ? (
              <div className="border-destructive/40 min-h-0 overflow-y-auto rounded-lg border p-3">
                <h4
                  ref={discardHeading}
                  tabIndex={-1}
                  className="font-semibold"
                >
                  {t('discardTitle')}
                </h4>
                <p className="text-ink-muted mt-2 text-sm">
                  {t('discardWarning')}
                </p>
                <Button
                  variant="link"
                  disabled={resolutionDisabled}
                  onClick={onExport}
                >
                  {t('export')}
                </Button>
                <div className="mt-3 flex flex-col gap-2">
                  <Button
                    className="h-auto min-h-10 whitespace-normal"
                    variant="danger"
                    disabled={resolutionDisabled}
                    onClick={() => onResolve('saved')}
                  >
                    {t('discardUseSaved')}
                  </Button>
                  <Button
                    className="h-auto min-h-10 whitespace-normal"
                    variant="ghost"
                    disabled={resolutionDisabled}
                    onClick={() => setDiscard(false)}
                  >
                    {t('backToChoices')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-paper-raised sm:border-hairline shrink-0 px-3 pb-2 sm:px-0 sm:pb-0">
                <p className="text-ink-muted mb-2 text-xs sm:mb-3 sm:text-sm">
                  {t('useSavedHelp')}
                </p>
                <Button
                  ref={savedAction}
                  className="h-auto min-h-10 w-full whitespace-normal"
                  variant="secondary"
                  disabled={resolutionDisabled}
                  onClick={() => setDiscard(true)}
                >
                  {t('useSaved')}
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>
      <footer className="bg-paper-raised sticky bottom-0 z-20 flex shrink-0 justify-end px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-3">
        <Button variant="ghost" data-cancel disabled={busy} onClick={onClose}>
          {t('closeComparison')}
        </Button>
      </footer>
    </>
  )
}

function VersionPreview({
  label,
  title,
  content,
  theme,
}: {
  label: string
  title: string | null
  content: string | null
  theme: NoteTheme | null
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-0">
      <NoteCard
        theme={theme}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div
          role="region"
          aria-label={label}
          tabIndex={0}
          style={{overflowAnchor: 'none'}}
          className="focus-visible:outline-accent min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg p-4 focus-visible:outline-2 focus-visible:-outline-offset-2"
        >
          {title && (
            <NoteReadOnly
              content={title}
              theme={theme}
              className="mb-8 font-serif text-lg font-semibold sm:text-xl"
            />
          )}
          <NoteReadOnly
            content={content}
            theme={theme}
            className="font-serif font-normal"
          />
        </div>
      </NoteCard>
    </div>
  )
}
