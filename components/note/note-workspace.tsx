'use client'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {usePathname, useRouter} from '~/i18n/navigation'
import {useSearchParams} from 'next/navigation'
import type {Note} from '~/db/schema/notes'
import {exportDrafts, listDrafts, type RecoveryDraft} from '~/lib/notes/drafts'
import {useMobileNoteView} from '~/lib/notes/mobile'
import {withBrowserWorkReturn} from '~/lib/notes/navigation'
import {recoveryNoteId} from '~/lib/notes/recovery-copies'
import {getNoteSync, type NoteSyncSession} from '~/lib/notes/session-sync'
import {snapshot} from '~/lib/notes/sync'
import {usePersistStore} from '~/store'
import useAttachedNoteVersions from './attached-note-versions'
import NoteConflictReview from './note-conflict-review'
import NoteSyncActions from './note-sync-actions'
import NoteWriting, {
  useNoteWriting,
  type NoteWritingEditors,
} from './note-writing'
import {NoteVersionPickerContent} from './note-version-picker'
import {selectNoteVersion, writeNoteSelection} from './note-version-selection'

type WorkspacePanel = {
  kind: 'review' | 'versions'
  titleId: string
  descriptionId: string
  content: ReactNode
  onClose: () => void
}

export type WorkspaceView = {
  editors: NoteWritingEditors
  actions: ReactNode
  panel?: WorkspacePanel
  writingInReview: boolean
  busy: boolean
}

function WorkspaceContent({
  render,
  view,
}: {
  render: (view: WorkspaceView) => ReactNode
  view: WorkspaceView
}) {
  return render(view)
}

function WorkspaceEditors({
  identity,
  pending,
  autofocus,
  draft,
  onEditors,
}: {
  identity: string
  pending: boolean
  autofocus: boolean
  draft: ReturnType<typeof snapshot>
  onEditors: (editors: NoteWritingEditors & {identity: string}) => void
}) {
  const {title, body, field} = useNoteWriting(
    identity,
    draft,
    pending,
    autofocus,
  )
  useLayoutEffect(() => {
    onEditors({identity, title, body, field})
  }, [identity, title, body, field, onEditors])
  return null
}

export default function NoteWorkspace({
  children,
}: {
  children: (view: WorkspaceView) => ReactNode
}) {
  const session = usePersistStore((state) => state.noteSession)
  const draft = usePersistStore((state) => state.mutateNoteData)
  const controller = getNoteSync()
  const {related, error: versionsError} = useAttachedNoteVersions(
    controller?.record,
  )
  const search = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const mobile = useMobileNoteView()
  const fromBrowserWork = search.get('from') === 'browser-work'
  const [surface, setSurface] = useState<'editor' | 'review' | 'versions'>(
    () =>
      session?.conflict &&
      (search.get('review') === '1' || controller?.record.editedCopyOf)
        ? 'review'
        : 'editor',
  )
  const [busy, setBusy] = useState(false)
  const [ownedEditors, setOwnedEditors] = useState<
    NoteWritingEditors & {identity: string}
  >()
  const [selectionFailed, setSelectionFailed] = useState(false)
  const [outgoing, setOutgoing] = useState<{
    session: NonNullable<typeof session>
    draft: ReturnType<typeof snapshot>
    record: RecoveryDraft
    related: RecoveryDraft[]
  }>()
  const operation = useRef(false)
  const pendingCopy = useRef<
    | {identity: string; creationId: string; draftId: string; linked: boolean}
    | undefined
  >(undefined)
  const titleId = useId()
  const descriptionId = useId()
  const shownSession = outgoing?.session ?? session
  const shownDraft = outgoing?.draft ?? snapshot(draft)
  const shownRecord = outgoing?.record ?? controller?.record
  const shownRelated = outgoing?.related ?? related
  const identity = shownSession?.identity
  const remote = shownSession?.conflict
  const readingIdentity =
    surface === 'review' && !outgoing && remote ? session?.identity : undefined

  useEffect(() => {
    if (readingIdentity && getNoteSync()?.record.id === readingIdentity)
      void getNoteSync()?.refreshRemote('review')
  }, [readingIdentity])

  const copyId = session?.baseline.id
  const copyPath = `${mobile || pathname.startsWith('/full/eton/') ? '/full' : ''}/eton/`
  const linkRecovery = useCallback(
    (draftId: string) => {
      const url = new URL(window.location.href)
      url.pathname = url.pathname.replace(
        /\/(?:full\/)?eton\/(?:recover\/)?[^/]+$/,
        `/full/eton/recover/${draftId}`,
      )
      url.search = ''
      if (fromBrowserWork) url.searchParams.set('from', 'browser-work')
      window.history.replaceState(null, '', url.href)
    },
    [fromBrowserWork],
  )
  useEffect(() => {
    const pending = pendingCopy.current
    if (!pending || pending.identity !== session?.identity) return
    if (pending.creationId === copyId) {
      pendingCopy.current = undefined
      router.replace(
        withBrowserWorkReturn(`${copyPath}${copyId}`, fromBrowserWork),
      )
    } else if (!pending.linked && getNoteSync()?.localSafe) {
      pending.linked = true
      linkRecovery(pending.draftId)
    }
  }, [copyId, session, copyPath, fromBrowserWork, router, linkRecovery])

  const run = async (action: () => Promise<void>) => {
    if (operation.current) return
    operation.current = true
    setBusy(true)
    try {
      await action()
    } finally {
      operation.current = false
      setBusy(false)
    }
  }

  const closePanel = () => {
    if (operation.current) return
    setSelectionFailed(false)
    setSurface('editor')
  }

  const select = async (source: NoteSyncSession, record?: RecoveryDraft) => {
    if (!session) return
    const note =
      source.record.conflict ??
      (source.record.baseline.id ? (source.record.baseline as Note) : undefined)
    setOutgoing({
      session,
      draft: snapshot(draft),
      record: source.record,
      related,
    })
    try {
      const next = await selectNoteVersion(
        source.record.ownerId,
        session.key,
        note,
        record,
      )
      if (!next) return
      writeNoteSelection(next, record)
      setSurface(next.record.conflict ? 'review' : 'editor')
    } finally {
      setOutgoing(undefined)
    }
  }

  const choose = (record?: RecoveryDraft) => {
    if (!controller) return
    void run(async () => {
      if (getNoteSync() !== controller) return
      setSelectionFailed(false)
      if (
        controller.dirty &&
        (!(await controller.persist()) || !controller.localSafe)
      ) {
        setSelectionFailed(true)
        return
      }
      if (getNoteSync() === controller) await select(controller, record)
    })
  }

  const discardCurrent = async (record: RecoveryDraft) => {
    if (!controller || record.id !== controller.record.id) return
    await run(async () => {
      const records = await listDrafts(controller.record.ownerId)
      const source = records.find(
        (row) =>
          row.versionId &&
          row.versionId === controller.record.editedCopyOf &&
          recoveryNoteId(row) === recoveryNoteId(controller.record),
      )
      if (
        usePersistStore.getState().noteSession?.identity === session?.identity
      )
        await select(controller, source)
    })
  }

  const editCopy = () => {
    if (!controller) return
    void run(async () => {
      const copy = await controller.editCopy()
      if (copy && getNoteSync() === controller) await select(controller, copy)
    })
  }

  const resolve = (choice: 'both' | 'mine' | 'saved') => {
    if (!controller) return
    void run(async () => {
      const result = await controller.resolve(choice, remote?.revision)
      if (getNoteSync() !== controller) return
      switch (result.status) {
        case 'created':
          setSurface('editor')
          router.replace(
            withBrowserWorkReturn(
              `${copyPath}${result.noteId}`,
              fromBrowserWork,
            ),
          )
          break
        case 'recoverable-copy':
        case 'copy-pending': {
          setSurface('editor')
          const linked = result.status === 'recoverable-copy'
          pendingCopy.current = {
            identity: controller.record.id,
            creationId: result.creationId,
            draftId: result.draftId,
            linked,
          }
          if (linked) linkRecovery(result.draftId)
          break
        }
        case 'resolved':
        case 'unavailable':
          setSurface('editor')
          break
      }
    })
  }

  const exportCurrent = () => {
    if (controller && getNoteSync() === controller)
      exportDrafts([controller.record])
  }

  if (!identity) return null

  const comparing = surface === 'review' && Boolean(remote)
  const writingInReview = comparing && Boolean(shownRecord?.editedCopyOf)
  const pending = busy || Boolean(shownSession?.operation)
  const actions = (
    <NoteSyncActions
      session={shownSession}
      disabled={pending}
      hasVersions={shownRelated.length > 0}
      onReview={() => setSurface('review')}
      onVersions={() => setSurface('versions')}
      onRetry={() => {
        if (!controller) return
        if (shownSession?.storageFailed) void controller.persist()
        else void controller.retry()
      }}
      onRecover={() => resolve('both')}
      onExport={exportCurrent}
    />
  )

  const editors =
    ownedEditors?.identity === identity
      ? ownedEditors
      : {title: null, body: null, field: 'title' as const}
  let panel: WorkspacePanel | undefined
  if (comparing && remote) {
    const headingId = `${titleId}-review`
    panel = {
      kind: 'review',
      titleId: headingId,
      descriptionId,
      onClose: closePanel,
      content: (
        <NoteConflictReview
          key={identity}
          titleId={headingId}
          descriptionId={descriptionId}
          remote={remote}
          draft={shownDraft}
          record={shownRecord}
          session={shownSession}
          busy={pending}
          resolutionPending={Boolean(controller?.resolutionPending)}
          writing={
            writingInReview && (
              <NoteWriting
                id={`comparison-${identity}`}
                editors={editors}
                pending={pending}
              />
            )
          }
          onClose={closePanel}
          onResolve={resolve}
          onRefresh={() => void controller?.refreshRemote('review')}
          onCheckpoint={() =>
            void run(async () => {
              await controller?.persist()
            })
          }
          onRetryResolution={() =>
            void run(async () => {
              await controller?.retry()
              if (getNoteSync() === controller && !controller?.record.conflict)
                setSurface('editor')
            })
          }
          onEditCopy={editCopy}
          onDiscardCopy={() =>
            shownRecord ? discardCurrent(shownRecord) : Promise.resolve()
          }
          onExport={exportCurrent}
        />
      ),
    }
  } else if (surface === 'versions') {
    const headingId = `${titleId}-versions`
    panel = {
      kind: 'versions',
      titleId: headingId,
      descriptionId,
      onClose: closePanel,
      content: (
        <NoteVersionPickerContent
          titleId={headingId}
          descriptionId={descriptionId}
          note={
            shownRecord && !shownRecord.unavailable && shownRecord.baseline.id
              ? (shownRecord.conflict ?? (shownRecord.baseline as Note))
              : undefined
          }
          records={
            shownRecord && (controller?.dirty || outgoing)
              ? [shownRecord, ...shownRelated]
              : shownRelated
          }
          busy={pending}
          error={versionsError || selectionFailed}
          dismissLabel="closeComparison"
          onChoose={choose}
          onClose={closePanel}
          onDiscard={(record) => void discardCurrent(record)}
        />
      ),
    }
  }
  return (
    <>
      <WorkspaceEditors
        key={identity}
        identity={identity}
        draft={shownDraft}
        pending={pending}
        autofocus={!comparing}
        onEditors={setOwnedEditors}
      />
      <WorkspaceContent
        render={children}
        view={{editors, actions, panel, writingInReview, busy: pending}}
      />
    </>
  )
}
