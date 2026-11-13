'use client'

import {useEffect, useRef, useState} from 'react'
import {useTranslations} from 'next-intl'
import NoteEditor, {useNoteEditor} from '../note-editor'
import {NOTE_TITLE_MAX_LENGTH} from '~/db/schema/notes'
import Button from '~/components/ui/button'
import {sanitizeNoteHtml} from '~/lib/notes/html'
import {openNote, sealNote} from '~/lib/notes/encryption/crypto'
import {
  currentVaultEpoch,
  getVaultRoot,
  registerVaultCheckpoint,
} from '~/lib/notes/encryption/runtime'
import {
  initializeEncryptedNote,
  listEncryptedNoteRecovery,
  openEncryptedRecovery,
  putEncryptedRecovery,
} from '~/lib/notes/encryption/storage'
import {
  RecoverySealQueue,
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
type Actions = {
  edit: (field: 'title' | 'content', value: string) => void
  flush: () => Promise<void>
  save: () => Promise<void>
  resolve: (mine: boolean) => Promise<void>
}

export default function EncryptedEditor({
  ownerId,
  vaultId,
  noteId,
  creating = false,
  readOnly = false,
  recordId,
  onClose,
}: {
  ownerId: string
  vaultId: string
  noteId: string
  creating?: boolean
  readOnly?: boolean
  recordId?: string
  onClose?: () => void
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
    ariaLabel: t('title'),
    editorVersion: version,
    pending: !ready,
    readOnly: readOnly || Boolean(conflict),
  })
  const body = useNoteEditor({
    initialValue: content.content,
    onChange: (v) => actions.current?.edit('content', v),
    onFocus: () => {},
    placeholder: t('body'),
    ariaLabel: t('body'),
    editorVersion: version,
    pending: !ready,
    readOnly: readOnly || Boolean(conflict),
  })

  useEffect(() => {
    const root = getVaultRoot(ownerId, vaultId)
    if (!root) return
    const epoch = currentVaultEpoch()
    let mounted = true,
      saving = false,
      durable = -1,
      preserved = -1,
      lastAttempt = 0
    let record: RecoveryPayload | null = null
    let persistedFlight: string | null = null
    let revision: string | null = null
    let idle: ReturnType<typeof setTimeout>,
      maximum: ReturnType<typeof setTimeout>
    let saveIdle: ReturnType<typeof setTimeout>,
      saveMaximum: ReturnType<typeof setTimeout>
    const valid = () =>
      mounted &&
      currentVaultEpoch() === epoch &&
      getVaultRoot(ownerId, vaultId) === root
    const report = (next: PersistenceStatus) => {
      if (valid()) setStatus(next)
    }
    const checkpoint = async () => {
      if (!record || record.route.generation <= durable) return
      const snapshot = structuredClone(record)
      const expected = persistedFlight
      const committed = await putEncryptedRecovery(
        root,
        snapshot,
        {
          updatedAt: Date.now(),
          status: snapshot.conflict
            ? 'conflict'
            : snapshot.flight
              ? 'flight'
              : snapshot.baseline &&
                  snapshot.draft.title === snapshot.baseline.title &&
                  snapshot.draft.content === snapshot.baseline.content &&
                  snapshot.draft.theme === snapshot.baseline.theme
                ? 'synced'
                : 'local',
          versionId: snapshot.route.recordId,
        },
        expected,
        durable,
      )
      if (!committed) {
        if (snapshot.route.generation > preserved) {
          const retained = structuredClone(snapshot)
          retained.route.recordId = crypto.randomUUID()
          if (
            await putEncryptedRecovery(root, retained, {
              updatedAt: Date.now(),
              status: 'retained',
              versionId: retained.route.recordId,
            })
          )
            preserved = snapshot.route.generation
        }
        throw new Error('Checkpoint superseded')
      }
      durable = snapshot.route.generation
      persistedFlight = snapshot.route.mutationId
      report(record.route.generation <= durable ? 'local' : 'unsaved')
    }
    const flush = async () => {
      if (readOnly) return
      clearTimeout(idle)
      clearTimeout(maximum)
      maximum = undefined!
      await seals.enqueue(noteId, checkpoint)
      if (record && durable < record.route.generation)
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
    const save = async () => {
      if (!record || !valid() || saving || readOnly || record.conflict) return
      saving = true
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
          if (!valid() || record.route.generation !== generation) return
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
        if (!valid()) return
        report('syncing')
        lastAttempt = Date.now()
        const result = await sendEncryptedFlight(noteId, record.flight!.request)
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
            return
          }
          record.baseline = {...remote, theme: result.note.theme}
          record.flight = null
          Object.assign(record.route, {
            generation: record.route.generation + 1,
            mutationId: null,
            flightDestination: null,
            expectedRevision: revision,
            noteId,
          })
          await flush()
          report(
            record.draft.title === remote.title &&
              record.draft.content === remote.content
              ? 'synced'
              : 'local',
          )
          window.dispatchEvent(new Event('encrypted-notes-changed'))
        } else report(result.status === 'unavailable' ? 'unavailable' : 'local')
      } catch {
        report('error')
      } finally {
        saving = false
        if (
          valid() &&
          record &&
          !record.conflict &&
          (record.flight ||
            !record.baseline ||
            record.draft.title !== record.baseline.title ||
            record.draft.content !== record.baseline.content)
        )
          scheduleSave()
      }
    }
    const scheduleSave = () => {
      clearTimeout(saveIdle)
      const wait = Math.max(3000, 10_000 - (Date.now() - lastAttempt))
      saveIdle = setTimeout(() => {
        void save()
      }, wait)
      saveMaximum ??= setTimeout(() => {
        void save()
      }, 30_000)
    }
    actions.current = {
      flush,
      save,
      edit(field, value) {
        if (!record || !valid() || readOnly || record.conflict) return
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
        if (!record?.conflict || !valid()) return
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
          if (!mine) record.draft = structuredClone(record.conflict)
          record.baseline = structuredClone(record.conflict)
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
          report('local')
          scheduleSave()
        } catch {
          report('error')
        }
      },
    }
    void (async () => {
      try {
        const headers = readOnly
          ? []
          : await listEncryptedNoteRecovery(ownerId, noteId)
        const header = recordId
          ? headers.find((h) => h.id === recordId)
          : headers
              .filter((h) => h.status !== 'retained')
              .sort((a, b) => b.updatedAt - a.updatedAt)[0]
        if (header) {
          record = await openEncryptedRecovery(root, ownerId, header.id)
          durable = record.route.generation
          persistedFlight = record.route.mutationId
          revision = record.conflictRevision ?? record.route.expectedRevision
          if (header.status === 'retained') {
            // Reviewing historical work starts a new working copy. The
            // preserved original must never become an editable checkpoint.
            record.route.recordId = crypto.randomUUID()
            durable = -1
            persistedFlight = null
          }
          if (
            !recordId &&
            record.route.noteId &&
            !record.flight &&
            !record.conflict
          ) {
            // Local recovery remains usable offline; an online reopen checks
            // whether another device has changed or removed the note.
            const remote = await fetchEncryptedNote(noteId).catch(
              () => undefined,
            )
            if (remote === null) {
              report('unavailable')
              return
            }
            if (remote && remote.revision !== revision) {
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
              const clean =
                record.baseline &&
                record.draft.title === record.baseline.title &&
                record.draft.content === record.baseline.content &&
                record.draft.theme === record.baseline.theme
              if (clean) {
                record.baseline = {...opened, theme: remote.theme}
                record.draft = structuredClone(record.baseline)
                record.route.expectedRevision = revision
              } else {
                record.conflict = {...opened, theme: remote.theme}
                record.conflictRevision = revision
              }
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
          if (remote && remote.authorId !== ownerId)
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
            baseline: remote ? draft : null,
            draft,
            conflict: null,
            flight: null,
            resolution: null,
          }
        }
        if (!valid()) return
        display()
        report(
          record.conflict
            ? 'conflict'
            : record.baseline &&
                record.draft.title === record.baseline.title &&
                record.draft.content === record.baseline.content &&
                !record.flight
              ? 'synced'
              : 'local',
        )
        if (record.flight) void save()
      } catch {
        report('error')
      }
    })()
    const online = () => {
      void save()
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
  }, [ownerId, vaultId, noteId, creating, readOnly, recordId, attempt])

  return (
    <section className="text-ink mx-auto flex w-full max-w-3xl flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-ink-muted text-sm">
          {t(status)}
        </p>
        <div className="flex gap-2">
          {!readOnly && (
            <Button
              variant="secondary"
              disabled={!ready || Boolean(conflict)}
              onClick={() => {
                void actions.current?.save()
              }}
            >
              {t('save')}
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              onClick={() => {
                void actions.current
                  ?.flush()
                  .then(onClose)
                  .catch(() => setStatus('error'))
              }}
            >
              {t('close')}
            </Button>
          )}
        </div>
      </div>
      <p className="text-ink-muted text-xs">{t('disclosure')}</p>
      {ready && (
        <>
          <NoteEditor
            id={`encrypted-title-${noteId}`}
            editor={title}
            className="font-serif text-2xl"
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
            className="prose prose-appearance mb-4 max-w-none"
            dangerouslySetInnerHTML={{
              __html: sanitizeNoteHtml(
                (conflict.title ?? '') + (conflict.content ?? ''),
              ),
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                void actions.current?.resolve(true)
              }}
            >
              {t('keepMine')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void actions.current?.resolve(false)
              }}
            >
              {t('useRemote')}
            </Button>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div role="alert" className="text-destructive text-sm">
          {t('failure')}{' '}
          <Button
            variant="link"
            onClick={() => {
              if (!ready) {
                setStatus('loading')
                setAttempt((value) => value + 1)
                return
              }
              void actions.current
                ?.flush()
                .then(() => setStatus('local'))
                .catch(() => setStatus('error'))
            }}
          >
            {t('retry')}
          </Button>
        </div>
      )}
    </section>
  )
}
