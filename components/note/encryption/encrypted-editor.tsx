'use client'

import {useEffect, useRef, useState} from 'react'
import {useTranslations} from 'next-intl'
import NoteEditor, {useNoteEditor} from '../note-editor'
import {NOTE_TITLE_MAX_LENGTH} from '~/db/schema/notes'
import Button, {buttonClass} from '~/components/ui/button'
import {Link} from '~/i18n/navigation'
import {sanitizeNoteHtml} from '~/lib/notes/html'
import {openNote, sealNote} from '~/lib/notes/encryption/crypto'
import {MAX_ENCRYPTED_TITLE_LENGTH} from '~/lib/notes/encryption/protocol'
import RefusedRecovery from './refused-recovery'
import {stageEncryptedRecovery} from '~/lib/notes/encryption/stage-recovery'
import type {EncryptedRemote} from '~/lib/notes/encryption/sync'
import {
  currentVaultEpoch,
  getVaultRoot,
  registerVaultCheckpoint,
} from '~/lib/notes/encryption/runtime'
import {
  initializeEncryptedNote,
  findEncryptedWorkingRecovery,
  getEncryptedRecoveryHeader,
  openEncryptedRecovery,
  putEncryptedRecovery,
} from '~/lib/notes/encryption/storage'
import {
  RecoverySealQueue,
  hasPendingEncryptedEdits,
  type RecoveryPayload,
} from '~/lib/notes/encryption/recovery'
import {
  fetchEncryptedNote,
  prepareEncryptedWrite,
  sendEncryptedFlight,
  validateEncryptedFlight,
} from '~/lib/notes/encryption/sync'

const seals = new RecoverySealQueue()
type PersistenceStatus =
  | 'loading'
  | 'local'
  | 'unsaved'
  | 'syncing'
  | 'synced'
  | 'conflict'
  | 'error'
  | 'unavailable'
  | 'disabled'
  | 'invalid_input'
  | 'reload_required'
  | 'review_required'
  | 'superseded'
  | 'title_limit'
  | 'close_pending'
  | 'recovery_error'
  | 'unauthenticated'
type SaveProgress =
  'saved' | 'changed' | 'retryable' | 'needsAttention' | undefined
type Actions = {
  edit: (field: 'title' | 'content', value: string) => void
  flush: () => Promise<void>
  close: () => Promise<boolean>
  save: () => Promise<SaveProgress>
  resume: () => Promise<void>
  retry: () => Promise<void>
  resolve: (mine: boolean) => Promise<void>
  recover: (target: EncryptedRemote | null) => Promise<void>
}

export default function EncryptedEditor({
  ownerId,
  vaultId,
  noteId,
  creating = false,
  readOnly = false,
  recordId,
  onClose,
  focusOnOpen = false,
  creationEnabled = false,
  onRecover,
}: {
  ownerId: string
  vaultId: string
  noteId: string
  creating?: boolean
  readOnly?: boolean
  recordId?: string
  onClose?: () => void
  focusOnOpen?: boolean
  creationEnabled?: boolean
  onRecover?: (value: {
    noteId: string
    recordId: string
    creating: boolean
  }) => void
}) {
  const t = useTranslations('note.encryptedEditor')
  const [content, setContent] = useState({
    title: null as string | null,
    content: null as string | null,
  })
  const [version, setVersion] = useState(0)
  const [ready, setReady] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<PersistenceStatus>('loading')
  const [refused, setRefused] = useState(false)
  const [recoveryPending, setRecoveryPending] = useState(false)
  const [resolutionPending, setResolutionPending] = useState(false)
  const [closePending, setClosePending] = useState(false)
  const [conflict, setConflict] = useState<{
    title: string | null
    content: string | null
  } | null>(null)
  const actions = useRef<Actions | null>(null)
  const title = useNoteEditor({
    initialValue: content.title,
    onChange: (v) => actions.current?.edit('title', v),
    onFocus: () => {},
    placeholder: t('title'),
    limitCharacter: NOTE_TITLE_MAX_LENGTH,
    autofocus: focusOnOpen ? 'start' : false,
    ariaLabel: t('title'),
    editorVersion: version,
    pending: !ready,
    readOnly: readOnly || Boolean(conflict) || recoveryPending || closePending,
  })
  const body = useNoteEditor({
    initialValue: content.content,
    onChange: (v) => actions.current?.edit('content', v),
    onFocus: () => {},
    placeholder: t('body'),
    ariaLabel: t('body'),
    editorVersion: version,
    pending: !ready,
    readOnly: readOnly || Boolean(conflict) || recoveryPending || closePending,
  })

  useEffect(() => {
    const root = getVaultRoot(ownerId, vaultId)
    if (!root) return
    const epoch = currentVaultEpoch()
    let mounted = true,
      closing = false,
      resolving = false,
      recovering = false,
      durable = -1,
      preserved = -1,
      lastAttempt = 0
    let pendingSave: Promise<SaveProgress> | undefined
    let retainedId: string | undefined
    let retainedFlight: string | null = null
    let inspectingRetained = false
    let canClosePending = false
    let record: RecoveryPayload | null = null
    let persistedFlight: string | null = null
    let revision: string | null = null
    let needsReconciliation = false
    let idle: ReturnType<typeof setTimeout>,
      maximum: ReturnType<typeof setTimeout>
    let saveIdle: ReturnType<typeof setTimeout>,
      saveMaximum: ReturnType<typeof setTimeout>
    const valid = () =>
      mounted &&
      currentVaultEpoch() === epoch &&
      getVaultRoot(ownerId, vaultId) === root
    const report = (next: PersistenceStatus) => {
      if (valid()) {
        setStatus(next)
        setRefused(Boolean(record?.refusal) && !retainedId)
      }
    }
    const titleTooLong = () =>
      (record?.draft.title?.length ?? 0) > MAX_ENCRYPTED_TITLE_LENGTH
    const localStatus = (): PersistenceStatus =>
      (retainedId ? 'superseded' : null) ??
      record?.refusal ??
      (record?.authenticationRequired ? 'unauthenticated' : null) ??
      (record?.conflict
        ? 'conflict'
        : needsReconciliation
          ? 'review_required'
          : titleTooLong()
            ? 'title_limit'
            : record && !hasPendingEncryptedEdits(record)
              ? 'synced'
              : 'local')
    const checkpoint = async () => {
      if (!record || record.route.generation <= Math.max(durable, preserved))
        return
      const snapshot = structuredClone(record)
      const committed =
        !retainedId &&
        (await putEncryptedRecovery(
          root,
          snapshot,
          {
            updatedAt: Date.now(),
            status: snapshot.conflict
              ? 'conflict'
              : snapshot.flight
                ? 'flight'
                : snapshot.baselineVerified &&
                    !hasPendingEncryptedEdits(snapshot)
                  ? 'synced'
                  : 'local',
            versionId: snapshot.route.recordId,
          },
          persistedFlight,
          durable,
        ))
      if (committed) {
        durable = snapshot.route.generation
        persistedFlight = snapshot.route.mutationId
      } else {
        retainedId ??= crypto.randomUUID()
        snapshot.route.recordId = retainedId
        // A flight first staged by the stale editor never reached the server.
        if (snapshot.flight && snapshot.route.mutationId !== persistedFlight) {
          snapshot.flight = null
          snapshot.route.mutationId = null
          snapshot.route.flightDestination = null
        }
        if (
          !(await putEncryptedRecovery(
            root,
            snapshot,
            {
              updatedAt: Date.now(),
              status: 'retained',
              versionId: retainedId,
            },
            retainedFlight,
            preserved,
          ))
        )
          throw new Error('Could not retain superseded checkpoint')
        preserved = snapshot.route.generation
        retainedFlight = snapshot.route.mutationId
      }
      report(
        record.route.generation <= Math.max(durable, preserved)
          ? localStatus()
          : 'unsaved',
      )
    }
    const flush = async () => {
      if (readOnly || inspectingRetained) return
      clearTimeout(idle)
      clearTimeout(maximum)
      maximum = undefined!
      await seals.enqueue(noteId, checkpoint)
      if (record && Math.max(durable, preserved) < record.route.generation)
        throw new Error('Latest edits are not saved')
    }
    const unregister = registerVaultCheckpoint(ownerId, flush)
    const display = () => {
      if (!valid() || !record) return
      setContent({
        title: sanitizeNoteHtml(record.draft.title),
        content: sanitizeNoteHtml(record.draft.content),
      })
      setVersion((v) => v + 1)
      setReady(true)
      setConflict(record.conflict)
    }
    const performSave = async (): Promise<SaveProgress> => {
      if (
        !record ||
        !valid() ||
        retainedId ||
        resolving ||
        readOnly ||
        record.conflict ||
        record.refusal ||
        record.authenticationRequired ||
        needsReconciliation ||
        !navigator.onLine ||
        (!record.flight && titleTooLong()) ||
        !hasPendingEncryptedEdits(record)
      )
        return
      clearTimeout(saveIdle)
      clearTimeout(saveMaximum)
      saveMaximum = undefined!
      try {
        if (!record.flight) {
          const generation = record.route.generation
          const draft = structuredClone(record.draft)
          const envelope = await sealNote(
            root,
            ownerId,
            {vaultId, noteId, contentId: crypto.randomUUID()},
            draft,
          )
          if (!valid()) return
          if (record.route.generation !== generation) return 'changed'
          const request = prepareEncryptedWrite(envelope, revision, draft.theme)
          const write = validateEncryptedFlight(request, noteId)
          record.flight = {
            destination: noteId,
            mutationId: write.mutationId,
            expectedRevision: revision,
            request,
          }
          Object.assign(record.route, {
            generation: generation + 1,
            flightDestination: noteId,
            mutationId: write.mutationId,
            expectedRevision: revision,
          })
        }
        await flush() // Immutable exact request must be durable before upload.
        if (!valid() || retainedId) return
        report('syncing')
        lastAttempt = Date.now()
        const result = await sendEncryptedFlight(
          noteId,
          record.flight!.request,
          fetch,
          AbortSignal.timeout(15_000),
        )
        if (!valid()) return
        if (result.status === 'success' || result.status === 'conflict') {
          if (result.note.authorId !== ownerId || result.note.id !== noteId)
            throw new Error('Remote identity mismatch')
          const remote = await openNote(
            root,
            ownerId,
            result.note.encryptedPayload,
            {vaultId, noteId},
          )
          if (!valid()) return
          revision = result.note.revision
          if (result.status === 'conflict') {
            record.conflict = {...remote, theme: result.note.theme}
            record.conflictRevision = revision
            record.route.generation++
            await flush()
            display()
            report('conflict')
            return 'needsAttention'
          }
          record.baseline = {...remote, theme: result.note.theme}
          record.baselineVerified = true
          record.flight = null
          Object.assign(record.route, {
            generation: record.route.generation + 1,
            mutationId: null,
            flightDestination: null,
            expectedRevision: revision,
            noteId,
          })
          await flush()
          canClosePending = false
          report(localStatus())
          window.dispatchEvent(new Event('encrypted-notes-changed'))
          return 'saved'
        } else if (result.status === 'retryable_error') {
          report(localStatus())
          return 'retryable'
        } else if (result.status === 'unauthenticated') {
          record.authenticationRequired = true
          record.route.generation++
          await flush()
          report('unauthenticated')
          return 'needsAttention'
        } else {
          // Keep the exact flight for recovery, but persist a terminal stop so
          // timers, reconnects and reopening cannot resend a refused operation.
          record.refusal = result.status
          record.route.generation++
          await flush()
          report(result.status)
          return 'needsAttention'
        }
      } catch {
        report('error')
        return 'retryable'
      } finally {
        if (valid() && record && hasPendingEncryptedEdits(record))
          scheduleSave()
      }
    }
    const save = () =>
      (pendingSave ??= performSave().finally(() => {
        pendingSave = undefined
      }))
    const scheduleSave = () => {
      if (
        readOnly ||
        closing ||
        retainedId ||
        inspectingRetained ||
        canClosePending ||
        !record ||
        record.conflict ||
        record.refusal ||
        record.authenticationRequired ||
        needsReconciliation ||
        (!record.flight && titleTooLong()) ||
        !navigator.onLine
      )
        return
      clearTimeout(saveIdle)
      const wait = Math.max(3000, 10_000 - (Date.now() - lastAttempt))
      saveIdle = setTimeout(() => {
        void save()
      }, wait)
      saveMaximum ??= setTimeout(() => {
        saveMaximum = undefined!
        void save()
      }, 30_000)
    }
    actions.current = {
      flush,
      async close() {
        closing = true
        setClosePending(true)
        try {
          await flush()
          if (
            record &&
            record.route.generation > 0 &&
            !inspectingRetained &&
            !canClosePending
          ) {
            let result = await save()
            // A prior flight may cover older input. A seal can also yield to
            // an edit made just before the editor became read-only.
            if (result === 'saved' || result === 'changed')
              result = await save()
            await flush()
            if (result === 'needsAttention') return false
            if (result === 'retryable') {
              canClosePending = true
              report('close_pending')
              return false
            }
          }
          return valid()
        } finally {
          closing = false
          if (valid()) {
            setClosePending(false)
            if (record && hasPendingEncryptedEdits(record)) scheduleSave()
          }
        }
      },
      save() {
        inspectingRetained = false
        return save()
      },
      async retry() {
        await flush()
        if (!valid()) return
        display()
        report(localStatus())
        if (record && hasPendingEncryptedEdits(record)) scheduleSave()
      },
      async recover(target) {
        if (
          !record?.refusal ||
          !valid() ||
          pendingSave ||
          retainedId ||
          recovering ||
          readOnly ||
          !onRecover ||
          (!target && !creationEnabled)
        )
          throw new Error('Recovery unavailable')
        recovering = true
        setRecoveryPending(true)
        try {
          await flush()
          if (!valid()) throw new Error('Vault locked')
          const source = structuredClone(record)
          const selected = await stageEncryptedRecovery(
            root,
            source,
            target,
            valid,
          )
          // Preserve any input already queued before the editor became read-only.
          await flush()
          if (valid()) onRecover(selected)
        } finally {
          recovering = false
          if (valid()) setRecoveryPending(false)
        }
      },
      async resume() {
        if (
          !record?.authenticationRequired ||
          !valid() ||
          pendingSave ||
          retainedId
        )
          return
        try {
          const response = await fetch('/api/auth/session', {
            cache: 'no-store',
            credentials: 'same-origin',
          })
          const session = await response.json()
          if (
            !valid() ||
            !response.ok ||
            session.error ||
            session.user?.id !== ownerId
          )
            return
          inspectingRetained = false
          delete record.authenticationRequired
          record.route.generation++
          await flush()
          await save()
        } catch {
          report('unauthenticated')
        }
      },
      edit(field, value) {
        if (!record || !valid() || readOnly || record.conflict || resolving)
          return
        inspectingRetained = false
        canClosePending = false
        record.draft[field] = value || null
        record.route.generation++
        report('unsaved')
        clearTimeout(idle)
        idle = setTimeout(() => {
          void seals.enqueue(noteId, checkpoint).catch(() => report('error'))
        }, 500)
        maximum ??= setTimeout(() => {
          maximum = undefined!
          void seals.enqueue(noteId, checkpoint).catch(() => report('error'))
        }, 2000)
        scheduleSave()
      },
      async resolve(mine) {
        if (
          !record?.conflict ||
          !valid() ||
          readOnly ||
          resolving ||
          pendingSave ||
          retainedId
        )
          return
        resolving = true
        setResolutionPending(true)
        const remote = structuredClone(record.conflict)
        try {
          // Preserve the original local/base/remote/flight before resolving.
          const retained = structuredClone(record)
          retained.route.recordId = crypto.randomUUID()
          if (
            !(await putEncryptedRecovery(root, retained, {
              updatedAt: Date.now(),
              status: 'retained',
              versionId: retained.route.recordId,
            }))
          )
            throw new Error('Preservation failed')
          if (!valid()) return
          inspectingRetained = false
          if (!mine) record.draft = structuredClone(remote)
          record.baseline = remote
          record.baselineVerified = true
          record.conflict = null
          record.conflictRevision = null
          record.flight = null
          Object.assign(record.route, {
            generation: record.route.generation + 1,
            mutationId: null,
            flightDestination: null,
            expectedRevision: revision,
          })
          await flush()
          display()
          report(localStatus())
          if (hasPendingEncryptedEdits(record)) scheduleSave()
        } catch {
          display()
          report('error')
        } finally {
          resolving = false
          if (valid()) setResolutionPending(false)
        }
      },
    }
    void (async () => {
      try {
        const header = recordId
          ? await getEncryptedRecoveryHeader(ownerId, recordId)
          : readOnly
            ? undefined
            : await findEncryptedWorkingRecovery(ownerId, noteId)
        if (header) {
          if (
            header.vaultId !== vaultId ||
            header.stableNoteId !== noteId ||
            header.recordId !== header.id
          )
            throw new Error('Recovery selection mismatch')
          const openedRecord = await openEncryptedRecovery(
            root,
            ownerId,
            header.id,
          )
          if (
            openedRecord.route.ownerId !== ownerId ||
            openedRecord.route.vaultId !== vaultId ||
            openedRecord.route.stableNoteId !== noteId ||
            openedRecord.route.recordId !== header.id
          )
            throw new Error('Recovery selection mismatch')
          record = openedRecord
          durable = record.route.generation
          persistedFlight = record.route.mutationId
          revision = record.conflictRevision ?? record.route.expectedRevision
          if (header.status === 'retained') {
            // Reviewing historical work starts a new working copy. The
            // preserved original must never become an editable checkpoint.
            record.route.recordId = crypto.randomUUID()
            durable = -1
            persistedFlight = null
            inspectingRetained = true
          }
          if (
            record.route.noteId &&
            !record.flight &&
            !record.conflict &&
            !record.refusal
          ) {
            // Local recovery remains usable offline; an online reopen checks
            // whether another device has changed or removed the note.
            const remote = await fetchEncryptedNote(noteId).catch(
              () => undefined,
            )
            if (!valid()) return
            needsReconciliation = !record.baselineVerified
            if (remote === null) {
              record.refusal = 'unavailable'
              record.route.generation++
              await flush()
            }
            if (
              remote &&
              (remote.revision !== revision ||
                needsReconciliation ||
                header.status === 'retained')
            ) {
              if (remote.authorId !== ownerId || remote.id !== noteId)
                throw new Error('Remote identity mismatch')
              const opened = await openNote(
                root,
                ownerId,
                remote.encryptedPayload,
                {vaultId, noteId},
              )
              if (!valid()) return
              revision = remote.revision
              const matchesRemote =
                record.draft.title === opened.title &&
                record.draft.content === opened.content &&
                record.draft.theme === remote.theme
              const clean =
                matchesRemote ||
                (record.baselineVerified &&
                  header.status !== 'retained' &&
                  !hasPendingEncryptedEdits(record))
              if (clean) {
                record.baseline = {...opened, theme: remote.theme}
                record.baselineVerified = true
                record.draft = structuredClone(record.baseline)
                record.route.expectedRevision = revision
              } else {
                record.conflict = {...opened, theme: remote.theme}
                record.conflictRevision = revision
              }
              needsReconciliation = false
              record.route.generation++
              await flush()
            }
          }
        } else {
          const remote = creating ? null : await fetchEncryptedNote(noteId)
          if (!valid()) return
          if (!creating && !remote) {
            report('unavailable')
            return
          }
          if (remote && (remote.authorId !== ownerId || remote.id !== noteId))
            throw new Error('Remote identity mismatch')
          const opened = remote
            ? await openNote(root, ownerId, remote.encryptedPayload, {
                vaultId,
                noteId,
              })
            : {title: null, content: null}
          if (!valid()) return
          const capturedEpoch = await initializeEncryptedNote(ownerId, noteId)
          const id = crypto.randomUUID()
          revision = remote?.revision ?? null
          const draft = {...opened, theme: remote?.theme ?? null}
          record = {
            version: 1,
            route: {
              ownerId,
              vaultId,
              stableNoteId: noteId,
              recordId: id,
              generation: 0,
              capturedEpoch,
              mode: 'encrypted',
              noteId: remote ? noteId : null,
              creationId: noteId,
              sourceNoteId: null,
              sourceEpoch: null,
              flightDestination: null,
              mutationId: null,
              expectedRevision: revision,
            },
            baseline: remote ? structuredClone(draft) : null,
            baselineVerified: true,
            draft,
            conflict: null,
            flight: null,
            resolution: null,
          }
        }
        if (!valid()) return
        display()
        report(localStatus())
        if (
          header &&
          header.status !== 'retained' &&
          hasPendingEncryptedEdits(record)
        ) {
          if (record.flight) void save()
          else scheduleSave()
        }
      } catch {
        report(recordId ? 'recovery_error' : 'error')
      }
    })()
    const online = () => {
      if (inspectingRetained) return
      if (needsReconciliation)
        void flush()
          .then(() => {
            if (valid()) setAttempt((value) => value + 1)
          })
          .catch(() => report('error'))
      else void save()
    }
    window.addEventListener('online', online)
    return () => {
      mounted = false
      actions.current = null
      // Keep the finalizer registered until the last dirty snapshot is durable.
      // A failed navigation checkpoint still participates in blocked locking.
      void flush()
        .then(unregister)
        .catch(() => {})
      clearTimeout(idle)
      clearTimeout(maximum)
      clearTimeout(saveIdle)
      clearTimeout(saveMaximum)
      window.removeEventListener('online', online)
    }
  }, [
    ownerId,
    vaultId,
    noteId,
    creating,
    readOnly,
    recordId,
    attempt,
    creationEnabled,
    onRecover,
  ])

  return (
    <section className="text-ink mx-auto flex w-full max-w-3xl flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-ink-muted text-sm">
          {t(status)}
        </p>
        <div className="flex flex-wrap gap-2">
          {!readOnly && (
            <Button
              variant="secondary"
              disabled={
                !ready ||
                closePending ||
                refused ||
                Boolean(conflict) ||
                [
                  'unavailable',
                  'disabled',
                  'invalid_input',
                  'reload_required',
                  'review_required',
                  'superseded',
                  'title_limit',
                  'unauthenticated',
                ].includes(status)
              }
              onClick={() => {
                void actions.current?.save()
              }}
            >
              {t('save')}
            </Button>
          )}
          {!readOnly && status === 'unauthenticated' && (
            <>
              <Link
                href="/login"
                className={buttonClass({variant: 'secondary'})}
              >
                {t('signIn')}
              </Link>
              <Button
                variant="secondary"
                onClick={() => void actions.current?.resume()}
              >
                {t('resumeAfterSignIn')}
              </Button>
            </>
          )}
          {onClose && (
            <Button
              variant="ghost"
              disabled={closePending || recoveryPending || resolutionPending}
              onClick={() => {
                void actions.current
                  ?.close()
                  .then((closed) => {
                    if (closed) onClose()
                  })
                  .catch(() => setStatus('error'))
              }}
            >
              {t('close')}
            </Button>
          )}
        </div>
      </div>
      <p className="text-ink-muted text-xs">{t('disclosure')}</p>
      {ready && refused && !readOnly && onRecover && (
        <RefusedRecovery
          ownerId={ownerId}
          vaultId={vaultId}
          creationEnabled={creationEnabled}
          recover={async (target) => {
            if (!actions.current) throw new Error('Recovery unavailable')
            await actions.current.recover(target)
          }}
        />
      )}
      {ready && (
        <>
          <NoteEditor
            id={`encrypted-title-${noteId}`}
            editor={title}
            className="font-serif text-2xl wrap-anywhere"
          />
          <NoteEditor
            id={`encrypted-body-${noteId}`}
            editor={body}
            className="min-h-64 font-serif"
          />
        </>
      )}
      {conflict && (
        <div className="border-control-border rounded-lg border p-4">
          <h2 className="mb-3 font-semibold">{t('review')}</h2>
          <div
            className="prose prose-appearance mb-4 max-w-none wrap-anywhere"
            dangerouslySetInnerHTML={{
              __html: sanitizeNoteHtml(
                (conflict.title ?? '') + (conflict.content ?? ''),
              ),
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={
                closePending || resolutionPending || status === 'superseded'
              }
              onClick={() => {
                void actions.current?.resolve(true)
              }}
            >
              {t('keepMine')}
            </Button>
            <Button
              variant="secondary"
              disabled={
                closePending || resolutionPending || status === 'superseded'
              }
              onClick={() => {
                void actions.current?.resolve(false)
              }}
            >
              {t('useRemote')}
            </Button>
          </div>
        </div>
      )}
      {(status === 'error' || status === 'recovery_error') && (
        <div role="alert" className="text-destructive text-sm">
          {t(status === 'recovery_error' ? 'recoveryFailure' : 'failure')}{' '}
          <Button
            variant="link"
            onClick={() => {
              if (!ready) {
                setStatus('loading')
                setAttempt((value) => value + 1)
                return
              }
              void actions.current?.retry().catch(() => setStatus('error'))
            }}
          >
            {t(status === 'recovery_error' ? 'retryOpen' : 'retry')}
          </Button>
        </div>
      )}
    </section>
  )
}
