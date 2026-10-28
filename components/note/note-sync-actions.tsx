'use client'

import {useEffect, useId, useRef, useState} from 'react'
import {useTranslations} from 'next-intl'
import {cn} from 'cn'
import {usePersistStore} from '~/store'
import {getNoteSync} from '~/lib/notes/session-sync'
import {exportDrafts} from '~/lib/notes/drafts'
import Button from '~/components/ui/button'
import ConfirmationDialog from '~/components/ui/confirmation-dialog'
import NoteReadOnly from './trash/note-read-only'
import NoteCard from './note-card'
import {useMobileNoteView} from '~/lib/notes/mobile'
import type {NoteTheme} from '~/db/schema/notes'
import {usePathname, useRouter} from '~/i18n/navigation'
import AttachedNoteVersions from './attached-note-versions'

export default function NoteSyncActions({className}: {className?: string}) {
  const t = useTranslations('note.recovery')
  const router = useRouter()
  const pathname = usePathname()
  const session = usePersistStore((s) => s.noteSession)
  const draft = usePersistStore((s) => s.mutateNoteData)
  const [review, setReview] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [busy, setBusy] = useState(false)
  const [side, setSide] = useState<'mine' | 'saved'>('mine')
  const mobile = useMobileNoteView()
  const tabs = useRef<Record<'mine' | 'saved', HTMLButtonElement | null>>({
    mine: null,
    saved: null,
  })
  const discardHeading = useRef<HTMLHeadingElement>(null)
  const savedAction = useRef<HTMLButtonElement>(null)
  const previousDiscard = useRef(false)
  const titleId = useId(),
    descriptionId = useId()
  const remote = session?.conflict
  const resolutionDisabled =
    busy || session?.checkingRemote || session?.remoteCheckFailed
  const unavailable = session?.syncStatus === 'unavailable'
  const failed = Boolean(
    session?.syncStatus &&
    ['unauthenticated', 'invalid_input', 'account_changed', 'failed'].includes(
      session.syncStatus,
    ),
  )
  const retryable = Boolean(
    session?.syncStatus &&
    [
      'local',
      'failed',
      'unauthenticated',
      'invalid_input',
      'account_changed',
    ].includes(session.syncStatus),
  )
  const exportable = Boolean(
    remote || unavailable || session?.storageFailed || retryable,
  )
  const actionClass =
    'h-auto min-h-10 max-w-full whitespace-normal max-sm:flex-1'
  useEffect(() => {
    if (discard) discardHeading.current?.focus()
    else if (previousDiscard.current) savedAction.current?.focus()
    previousDiscard.current = discard
  }, [discard])
  const exportCurrent = () => {
    const controller = getNoteSync()
    if (controller) exportDrafts([controller.record])
  }
  const openReview = async () => {
    setReview(true)
    setDiscard(false)
    await getNoteSync()?.refreshRemote('review')
  }
  const resolve = async (choice: 'both' | 'mine' | 'saved') => {
    setBusy(true)
    try {
      await getNoteSync()?.resolve(choice, remote?.revision)
      const controller = getNoteSync()
      if (
        choice === 'both' &&
        controller?.record.noteId &&
        !controller.record.conflict &&
        controller.record.baseline.id === controller.record.noteId
      ) {
        router.replace(
          `${mobile || pathname.startsWith('/full/eton/') ? '/full' : ''}/eton/${controller.record.noteId}`,
        )
      }
      if (!usePersistStore.getState().noteSession?.conflict) {
        setReview(false)
        setDiscard(false)
      }
    } finally {
      setBusy(false)
    }
  }
  if (!remote && !unavailable && !session?.storageFailed && !retryable)
    return <AttachedNoteVersions className={className} />
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <AttachedNoteVersions />
      {session?.storageFailed && (
        <p className="text-destructive text-sm" role="alert">
          {t('storageFailed')}
        </p>
      )}
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {t(
            session!.syncStatus as
              | 'unauthenticated'
              | 'invalid_input'
              | 'account_changed'
              | 'failed',
          )}
        </p>
      )}
      {unavailable && (
        <p role="alert" className="text-warning text-sm">
          {t('unavailable')}
        </p>
      )}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {remote && (
          <Button
            className={actionClass}
            size="sm"
            variant="secondary"
            onClick={() => void openReview()}
          >
            {t('review')}
          </Button>
        )}
        {unavailable && (
          <Button
            className={actionClass}
            size="sm"
            onClick={() => void resolve('both')}
            disabled={busy}
          >
            {t('recoverNew')}
          </Button>
        )}
        {retryable && (
          <Button
            className={actionClass}
            size="sm"
            variant="secondary"
            onClick={() => void getNoteSync()?.retry()}
          >
            {t('retry')}
          </Button>
        )}
        {exportable && (
          <Button
            className={actionClass}
            size="sm"
            variant="ghost"
            onClick={exportCurrent}
          >
            {t('export')}
          </Button>
        )}
      </div>
      {remote && (
        <ConfirmationDialog
          open={review}
          busy={busy}
          onRequestClose={() => {
            setReview(false)
            setDiscard(false)
          }}
          labelledBy={titleId}
          describedBy={descriptionId}
          initialFocusId={titleId}
          layout="workspace"
        >
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
            {session?.checkingRemote && (
              <p role="status" className="text-ink-muted mt-2 text-xs">
                {t('checkingSaved')}
              </p>
            )}
            {session?.remoteCheckFailed && (
              <div
                role="alert"
                className="text-destructive mt-2 flex flex-wrap items-center gap-2 text-xs"
              >
                <p>{t('refreshFailed')}</p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void openReview()}
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
                <p className="text-ink-muted mt-1 hidden text-sm sm:block">
                  {t('keepBothHelp')}
                </p>
                <p className="text-ink-muted mt-1 text-xs sm:hidden">
                  {t('keepBothShortHelp')}
                </p>
              </div>
              <Button
                className="shrink-0"
                disabled={resolutionDisabled}
                onClick={() => void resolve('both')}
              >
                {t('keepBoth')}
              </Button>
            </section>
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
                    {t(value)}
                  </Button>
                ))}
              </div>
            )}
          </header>
          <div className="flex min-h-0 flex-1 flex-col sm:px-6 sm:pb-6">
            <div className="grid min-h-0 flex-1 items-stretch sm:mt-4 sm:grid-cols-2 sm:gap-4">
              <section
                id={`${titleId}-panel-mine`}
                role={mobile ? 'tabpanel' : undefined}
                aria-labelledby={mobile ? `${titleId}-tab-mine` : undefined}
                hidden={mobile && side !== 'mine'}
                className={cn(
                  'sm:border-hairline flex min-h-0 min-w-0 flex-col overflow-hidden sm:rounded-lg sm:border sm:p-4',
                  side === 'saved' && 'max-sm:hidden',
                )}
              >
                <h3 className="hidden font-semibold sm:block">{t('mine')}</h3>
                <div
                  role="region"
                  aria-label={t('mine')}
                  tabIndex={0}
                  className="focus-visible:outline-accent min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2 sm:my-4 sm:rounded-lg"
                >
                  <VersionPreview
                    mobile={mobile}
                    theme={draft?.theme ?? null}
                    title={draft?.title ?? null}
                    content={draft?.content ?? null}
                  />
                </div>
                <div className="bg-paper-raised sm:border-hairline shrink-0 px-3 py-2 sm:border-t sm:px-0 sm:pt-3 sm:pb-0">
                  <p className="text-ink-muted mb-2 text-xs sm:mb-3 sm:text-sm">
                    {t('useMineHelp')}
                  </p>
                  <Button
                    className="h-auto min-h-10 w-full whitespace-normal"
                    variant="secondary"
                    disabled={resolutionDisabled}
                    onClick={() => void resolve('mine')}
                  >
                    {t('useMine')}
                  </Button>
                </div>
              </section>
              <section
                id={`${titleId}-panel-saved`}
                role={mobile ? 'tabpanel' : undefined}
                aria-labelledby={mobile ? `${titleId}-tab-saved` : undefined}
                hidden={mobile && side !== 'saved'}
                className={cn(
                  'sm:border-hairline flex min-h-0 min-w-0 flex-col overflow-hidden sm:rounded-lg sm:border sm:p-4',
                  side === 'mine' && 'max-sm:hidden',
                )}
              >
                <h3 className="hidden font-semibold sm:block">{t('saved')}</h3>
                <div
                  role="region"
                  aria-label={t('saved')}
                  tabIndex={0}
                  className="focus-visible:outline-accent min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline-2 focus-visible:-outline-offset-2 sm:my-4 sm:rounded-lg"
                >
                  <VersionPreview
                    mobile={mobile}
                    theme={remote.theme}
                    title={remote.title}
                    content={remote.content}
                  />
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
                      onClick={exportCurrent}
                    >
                      {t('export')}
                    </Button>
                    <div className="mt-3 flex flex-col gap-2">
                      <Button
                        className="h-auto min-h-10 whitespace-normal"
                        variant="danger"
                        disabled={resolutionDisabled}
                        onClick={() => void resolve('saved')}
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
                  <div className="bg-paper-raised sm:border-hairline shrink-0 px-3 py-2 sm:border-t sm:px-0 sm:pt-3 sm:pb-0">
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
            <Button
              variant="ghost"
              data-cancel
              disabled={busy}
              onClick={() => setReview(false)}
            >
              {t('reviewLater')}
            </Button>
          </footer>
        </ConfirmationDialog>
      )}
    </div>
  )
}

function VersionPreview({
  mobile,
  title,
  content,
  theme,
}: {
  mobile: boolean
  title: string | null
  content: string | null
  theme: NoteTheme | null
}) {
  const contents = (
    <>
      {title && (
        <NoteReadOnly
          content={title}
          theme={theme}
          className="font-serif text-lg font-semibold"
        />
      )}
      <NoteReadOnly
        content={content}
        theme={theme}
        className="font-serif font-normal"
      />
    </>
  )
  return mobile ? (
    <div
      className={cn(
        'min-h-full px-3 py-3',
        theme ? `dialog-${theme}` : 'bg-paper-raised',
      )}
    >
      {contents}
    </div>
  ) : (
    <NoteCard theme={theme} className="min-h-full p-4">
      {contents}
    </NoteCard>
  )
}
