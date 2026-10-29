'use client'

import type {Note} from '~/db/schema/notes'
import type {NoteStoreState} from '~/types/note'
import {noteRecoveryGroups, sameRecoveryCopy} from './recovery-copies'
import {usePersistStore} from '~/store'
import {
  clearAccountDrafts,
  clearDraftBatch,
  clearDraft,
  listDrafts,
  putDraft,
  type RecoveryDraft,
} from './drafts'
import {
  meaningfulContent,
  reconcile,
  sameContent,
  snapshot,
  type SyncRequest,
  type SyncResult,
} from './sync'

type Session = NonNullable<NoteStoreState['noteSession']>
export type NoteSyncDependencies = {
  put: typeof putDraft
  clear: typeof clearDraft
  list: (ownerId: string) => Promise<RecoveryDraft[]>
  send: (request: SyncRequest) => Promise<SyncResult>
  read: (noteId: string, ownerId: string) => Promise<SyncResult>
}
const defaultDependencies: NoteSyncDependencies = {
  put: putDraft,
  clear: clearDraft,
  list: listDrafts,
  read: async (noteId, ownerId) => {
    const response = await fetch(`/api/note/${noteId}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: AbortSignal.timeout(10000),
    })
    if (response.status === 401 || response.status === 403)
      return {status: 'unauthenticated'}
    if (response.status === 404) return {status: 'unavailable'}
    if (!response.ok) return {status: 'retryable_error'}
    const note = (await response.json()) as Note
    if (note.authorId !== ownerId) return {status: 'account_changed'}
    return {status: 'success', note}
  },
  send: async (request) => {
    const response = await fetch('/api/note/sync', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(20000),
    })
    return (await response.json()) as SyncResult
  },
}
const controllers = new Map<string, NoteSyncSession>()
let account: string | undefined
export const getNoteSync = () => {
  const id = usePersistStore.getState().noteSession?.identity
  return id ? controllers.get(id) : undefined
}
export function setNoteSyncAccount(ownerId?: string) {
  if (account === ownerId) return
  account = ownerId
  for (const [id, controller] of controllers) {
    if (controller.record.ownerId !== ownerId) {
      void controller.detach()
      controllers.delete(id)
    }
  }
  if (getNoteSync()?.record.ownerId !== ownerId)
    usePersistStore.getState().setMutateNoteData(undefined)
}

// Controllers outlive a view handoff. Timers exist only for dirty work, never
// idle polling; one in-flight request retains its exact retry identity/snapshot.
export class NoteSyncSession {
  record: RecoveryDraft
  private state: Session
  private stopped = false
  private dirtySince = 0
  private localSince = 0
  private lastAttempt = 0
  private failures = 0
  private localTimer?: ReturnType<typeof setTimeout>
  private serverTimer?: ReturnType<typeof setTimeout>
  private running?: Promise<void>
  private refreshing?: Promise<boolean>
  private localWrites: Promise<boolean> = Promise.resolve(true)
  private unsubscribe: () => void

  constructor(
    ownerId: string,
    session: Session,
    draft?: Partial<Note>,
    private io: NoteSyncDependencies = defaultDependencies,
  ) {
    this.state = session
    this.record = {
      id: session.identity,
      ownerId,
      noteId: session.baseline.id ?? null,
      creationId: crypto.randomUUID(),
      baseline: session.baseline,
      draft: snapshot(draft),
      generation: session.generation ?? 0,
      updatedAt: Date.now(),
    }
    controllers.set(session.identity, this)
    this.unsubscribe = usePersistStore.subscribe((store) => {
      if (store.noteSession?.identity !== this.record.id || this.stopped) return
      const value = snapshot(store.mutateNoteData)
      if (sameContent(value, this.record.draft)) return
      this.record = {
        ...this.record,
        draft: value,
        generation: this.record.generation + 1,
        updatedAt: Date.now(),
      }
      this.publish({generation: this.record.generation})
      this.schedule()
    })
  }
  private publish(patch: Partial<Session>) {
    this.state = {...this.state, ...patch}
    const store = usePersistStore.getState()
    if (store.noteSession?.identity === this.record.id)
      usePersistStore.setState({noteSession: {...store.noteSession, ...patch}})
  }
  private replaceContent(value: Partial<Note>) {
    // Only reconciliation/recovery/resolution updates editor content. Ordinary
    // acknowledgements and acquisition of a server ID never replace editors.
    this.record = {
      ...this.record,
      draft: snapshot(value),
      generation: this.record.generation + 1,
      updatedAt: Date.now(),
    }
    if (usePersistStore.getState().noteSession?.identity === this.record.id) {
      usePersistStore.setState({
        mutateNoteData: {
          ...usePersistStore.getState().mutateNoteData,
          ...value,
        } as Note,
      })
      this.publish({
        generation: this.record.generation,
        editorVersion: (this.state.editorVersion ?? 0) + 1,
      })
    }
  }
  get dirty() {
    return (
      Boolean(this.record.flight) ||
      ((Boolean(this.record.noteId) || meaningfulContent(this.record.draft)) &&
        !sameContent(this.record.draft, this.record.baseline))
    )
  }
  get localSafe() {
    return this.state.localGeneration === this.record.generation
  }
  get blocked() {
    return Boolean(
      this.record.conflict ||
      this.record.unavailable ||
      ['unauthenticated', 'invalid_input', 'account_changed'].includes(
        this.state.syncStatus ?? '',
      ),
    )
  }

  async hydrate(recovery?: RecoveryDraft, skipStored = false) {
    try {
      const capturedCopies = recovery
        ? (
            await this.io.list(this.record.ownerId).catch(() => [recovery])
          ).filter((row) => sameRecoveryCopy(row, recovery))
        : []
      const records = recovery
        ? [recovery]
        : this.record.noteId && !skipStored
          ? await this.io.list(this.record.ownerId)
          : []
      if (this.stopped) return
      const saved =
        recovery?.ownerId === this.record.ownerId
          ? recovery
          : (() => {
              const groups = noteRecoveryGroups(
                records.filter((row) => row.id !== this.record.id),
                this.record.ownerId,
                this.record.noteId!,
              )
              return groups.length === 1 ? groups[0].record : undefined
            })()
      if (saved) {
        const server = this.record.baseline
        this.record = {
          ...saved,
          id: this.record.id,
          generation: saved.generation + 1,
          updatedAt: Date.now(),
        }
        if (server.id) {
          this.record.noteId = server.id
          const result = reconcile(
            saved.baseline,
            saved.draft,
            snapshot(server),
          )
          this.record.draft = result.merged
          if (result.conflicts.length) {
            this.record.conflict = server as Note
          } else {
            // A pending request is retried unchanged before saving a merged draft.
            if (!saved.flight) this.record.baseline = server
          }
        }
        this.replaceContent({
          ...this.record.draft,
          ...(this.record.noteId ? {id: this.record.noteId} : {}),
        })
        const persisted = await this.persist()
        // Explicitly reopening a draft resumes that copy. Retire its captured
        // generation only after this session is durable (locally or on server).
        // Automatic recovery still preserves copies belonging to other sessions.
        if (
          recovery &&
          saved.id !== this.record.id &&
          persisted &&
          (this.localSafe ||
            (!this.dirty &&
              Boolean(this.record.noteId) &&
              !this.record.conflict &&
              !this.record.unavailable))
        ) {
          const copies = new Map([[saved.id, saved]])
          for (const row of capturedCopies)
            if (row.id !== this.record.id && sameRecoveryCopy(row, saved))
              copies.set(row.id, row)
          for (const copy of copies.values()) {
            const source = controllers.get(copy.id)
            if (
              source &&
              source.record.generation === copy.generation &&
              sameRecoveryCopy(source.record, copy)
            ) {
              source.stop()
              await source.drained()
            }
            await this.io.clear(copy.id, copy.generation)
          }
        }
      }
    } catch {
      this.publish({storageFailed: true})
    } finally {
      if (!this.stopped) {
        this.publish({
          hydrated: true,
          baseline: this.record.baseline,
          ...(this.record.unavailable ? {syncStatus: 'unavailable'} : {}),
          ...(this.record.conflict
            ? {syncStatus: 'conflict', conflict: this.record.conflict}
            : {}),
        })
        if (this.dirty) this.schedule()
      }
    }
  }
  private schedule() {
    if (this.stopped || !this.state.hydrated) return
    if (
      !this.record.noteId &&
      !this.record.flight &&
      !meaningfulContent(this.record.draft)
    ) {
      if (this.localTimer) clearTimeout(this.localTimer)
      if (this.serverTimer) clearTimeout(this.serverTimer)
      return
    }
    if (!this.dirty && !this.record.conflict) {
      if (this.localTimer) clearTimeout(this.localTimer)
      if (this.serverTimer) clearTimeout(this.serverTimer)
      this.publish({syncStatus: this.record.noteId ? 'saved' : undefined})
      // A reverted draft can be cleared only when no ambiguous request exists.
      const generation = this.record.generation
      void this.localWrites
        .then(async () => {
          await this.io.clear(this.record.id, generation)
          if (this.record.generation === generation && !this.dirty)
            this.publish({localGeneration: undefined})
        })
        .catch(() => this.publish({storageFailed: true}))
      return
    }
    const now = Date.now()
    this.localSince ||= now
    this.dirtySince ||= now
    if (this.localTimer) clearTimeout(this.localTimer)
    this.localTimer = setTimeout(
      () => {
        this.localSince = 0
        void this.persist()
      },
      Math.max(0, Math.min(500, this.localSince + 2000 - now)),
    )
    if (!this.blocked && !this.running && !this.failures)
      this.publish({syncStatus: 'pending'})
    if (this.blocked || this.failures || this.running || this.refreshing) return
    if (this.serverTimer) clearTimeout(this.serverTimer)
    const due = Math.max(
      this.lastAttempt + 10000,
      Math.min(now + 3000, this.dirtySince + 30000),
    )
    this.serverTimer = setTimeout(
      () => void this.flush(),
      Math.max(0, due - now),
    )
  }
  persist(): Promise<boolean> {
    if (this.stopped) return Promise.resolve(false)
    if (!this.dirty && !this.record.conflict && !this.record.unavailable)
      return Promise.resolve(true)
    if (
      !this.record.noteId &&
      !this.record.flight &&
      !meaningfulContent(this.record.draft)
    )
      return Promise.resolve(true)
    const captured = structuredClone(this.record)
    this.localWrites = this.localWrites.then(async () => {
      if (this.stopped) return false
      try {
        await this.io.put(captured)
        if (!this.stopped)
          this.publish({
            localGeneration: captured.generation,
            storageFailed: false,
          })
        return true
      } catch {
        this.publish({storageFailed: true})
        return false
      }
    })
    return this.localWrites
  }
  async flush(
    kind: 'save' | 'trash' = 'save',
    explicit = false,
  ): Promise<void> {
    if (this.stopped) return
    if (this.refreshing) {
      await this.refreshing
      if (this.stopped) return
    }
    if (explicit) {
      this.failures = 0
      if (this.serverTimer) clearTimeout(this.serverTimer)
    }
    if (this.running) {
      await this.running
      if (explicit && !this.blocked && this.dirty && !this.failures)
        return this.flush(kind, true)
      return
    }
    if (this.blocked) {
      await this.persist()
      return
    }
    if (kind === 'save' && !this.dirty) return
    if (!this.record.noteId && !meaningfulContent(this.record.draft)) return
    const run = this.send(kind)
    this.running = run
    try {
      await run
    } finally {
      this.running = undefined
      if (this.dirty && !this.stopped) this.schedule()
    }
  }
  private async send(kind: 'save' | 'trash') {
    this.record.flight ??= {
      ownerId: this.record.ownerId,
      noteId: this.record.noteId,
      creationId: this.record.creationId,
      mutationId: crypto.randomUUID(),
      expectedRevision: this.record.baseline.revision ?? null,
      content: {...this.record.draft},
      kind,
    }
    const flight = this.record.flight
    // Save retry identity before transport when storage works. Network may still
    // save when local storage is unavailable; status never claims local success.
    await this.persist()
    if (this.stopped) return
    this.lastAttempt = Date.now()
    this.publish({syncStatus: 'saving'})
    let result: SyncResult
    const started = performance.now()
    try {
      result = await this.io.send(flight)
      if (
        ![
          'success',
          'conflict',
          'unavailable',
          'invalid_input',
          'unauthenticated',
          'account_changed',
          'retryable_error',
        ].includes(result.status)
      )
        result = {status: 'retryable_error'}
    } catch {
      result = {status: 'retryable_error'}
    }
    // Content-free measurement event; no document identifiers or text.
    window.dispatchEvent(
      new CustomEvent('note-save-measurement', {
        detail: {
          durationMs: Math.round(performance.now() - started),
          bytes: new TextEncoder().encode(JSON.stringify(flight)).length,
          status: result.status,
          explicit: Boolean(this.state.operation),
        },
      }),
    )
    if (this.stopped) return
    if (result.status === 'retryable_error') {
      this.failures++
      this.publish({syncStatus: this.localSafe ? 'local' : 'failed'})
      // Four bounded retries; online/focus or explicit Retry can restart later.
      if (this.failures <= 4)
        this.serverTimer = setTimeout(
          () => void this.flush(),
          Math.max(
            10000,
            Math.min(60000, 2000 * 2 ** this.failures) + Math.random() * 1000,
          ),
        )
      return
    }
    this.record.flight = undefined
    this.failures = 0
    if (result.status === 'success') {
      this.record.noteId = result.note.id
      this.record.baseline = result.note
      if (!this.dirty) this.dirtySince = 0
      if (usePersistStore.getState().noteSession?.identity === this.record.id) {
        usePersistStore.setState({
          mutateNoteData: {
            ...usePersistStore.getState().mutateNoteData,
            id: result.note.id,
            authorId: this.record.ownerId,
          } as Note,
        })
      }
      this.publish({
        baseline: result.note,
        syncStatus: this.dirty ? 'pending' : 'saved',
      })
      window.dispatchEvent(new CustomEvent('note-saved', {detail: result.note}))
      if (!this.dirty) {
        const acknowledgedGeneration = this.record.generation
        await this.localWrites
        try {
          await this.io.clear(this.record.id, acknowledgedGeneration)
          if (this.record.generation === acknowledgedGeneration && !this.dirty)
            this.publish({localGeneration: undefined})
        } catch {
          this.publish({storageFailed: true})
        }
        if (usePersistStore.getState().noteSession?.identity !== this.record.id)
          this.stop()
      } else await this.persist()
      return
    }
    if (result.status === 'conflict') {
      // Creation existence proves the stable identity committed earlier. Use
      // that submitted snapshot as the base when its response was lost.
      const base = flight.noteId ? this.record.baseline : flight.content
      this.record.noteId = result.note.id
      const resolution = reconcile(
        base,
        this.record.draft,
        snapshot(result.note),
      )
      if (resolution.conflicts.length || flight.kind === 'trash') {
        if (!sameContent(this.record.draft, resolution.merged))
          this.replaceContent(resolution.merged)
        this.record.conflict = result.note
        this.publish({syncStatus: 'conflict', conflict: result.note})
      } else {
        this.record.baseline = result.note
        this.replaceContent(resolution.merged)
        this.publish({
          baseline: result.note,
          syncStatus: this.dirty ? 'pending' : 'saved',
        })
        if (!this.dirty) {
          const generation = this.record.generation
          await this.localWrites
          try {
            await this.io.clear(this.record.id, generation)
          } catch {
            this.publish({storageFailed: true})
          }
          return
        }
      }
    } else {
      this.record.unavailable = result.status === 'unavailable'
      this.publish({syncStatus: result.status})
    }
    await this.persist()
  }
  refreshRemote(
    mode: 'review' | 'visibility' = 'visibility',
  ): Promise<boolean> {
    if (this.stopped || !this.record.noteId || this.record.unavailable)
      return Promise.resolve(false)
    if (this.refreshing) return this.refreshing
    if (this.serverTimer) clearTimeout(this.serverTimer)
    this.publish({checkingRemote: true, remoteCheckFailed: false})
    const check = this.readRemote(mode)
    this.refreshing = check
    return check.finally(() => {
      this.refreshing = undefined
      if (!this.stopped) {
        this.publish({checkingRemote: false})
        if (this.dirty && !this.blocked && !this.failures) this.schedule()
      }
    })
  }
  private async readRemote(mode: 'review' | 'visibility'): Promise<boolean> {
    if (this.running) await this.running
    if (this.stopped || !this.record.noteId || this.record.unavailable)
      return false
    let result: SyncResult
    try {
      result = await this.io.read(this.record.noteId, this.record.ownerId)
    } catch {
      result = {status: 'retryable_error'}
    }
    if (this.stopped) return false
    if (result.status === 'retryable_error') {
      this.publish({remoteCheckFailed: true})
      return false
    }
    if (result.status !== 'success') {
      this.record.unavailable = result.status === 'unavailable'
      if (this.record.unavailable) this.record.conflict = undefined
      this.publish({
        syncStatus: result.status,
        conflict: this.record.conflict,
        remoteCheckFailed: true,
      })
      await this.persist()
      return false
    }
    const remote = result.note
    const flight = this.record.flight
    let confirmedFlight = false
    this.failures = 0
    // A GET may confirm a committed save whose response was lost. Otherwise
    // retain the exact retry identity rather than silently dropping that intent.
    if (
      flight?.kind === 'save' &&
      remote.lastMutationId === flight.mutationId &&
      sameContent(remote, flight.content)
    ) {
      this.record.flight = undefined
      this.record.baseline = remote
      confirmedFlight = true
    }
    if (mode === 'review' && this.record.conflict) {
      const merged = reconcile(
        this.record.baseline,
        this.record.draft,
        snapshot(remote),
      ).merged
      if (!sameContent(this.record.draft, merged)) this.replaceContent(merged)
      this.record.conflict = remote
      this.publish({
        conflict: remote,
        syncStatus: 'conflict',
        remoteCheckFailed: false,
      })
      await this.persist()
      return true
    }
    if (remote.revision === this.record.baseline.revision && !confirmedFlight) {
      this.publish({
        remoteCheckFailed: false,
        ...(!this.record.conflict
          ? {syncStatus: this.dirty ? ('pending' as const) : ('saved' as const)}
          : {}),
      })
      return true
    }
    // Compare against the latest local draft at response time, including edits
    // made while the read was pending. HTML fields remain indivisible.
    const resolution = reconcile(
      this.record.baseline,
      this.record.draft,
      snapshot(remote),
    )
    if (!sameContent(this.record.draft, resolution.merged))
      this.replaceContent(resolution.merged)
    if (resolution.conflicts.length) {
      this.record.conflict = remote
      this.publish({
        conflict: remote,
        syncStatus: 'conflict',
        remoteCheckFailed: false,
      })
      await this.persist()
      return true
    }
    this.record.baseline = remote
    this.record.conflict = undefined
    this.publish({
      baseline: remote,
      conflict: undefined,
      syncStatus: this.dirty ? 'pending' : 'saved',
      remoteCheckFailed: false,
    })
    if (this.dirty) await this.persist()
    else {
      const generation = this.record.generation
      await this.localWrites
      try {
        await this.io.clear(this.record.id, generation)
        if (this.record.generation === generation && !this.dirty)
          this.publish({localGeneration: undefined})
      } catch {
        this.publish({storageFailed: true})
      }
    }
    return true
  }
  async resolve(choice: 'both' | 'saved' | 'mine', shownRevision?: string) {
    if (this.running || this.stopped) return
    const remote = this.record.conflict
    if (choice !== 'both' && (!remote || remote.revision !== shownRevision))
      return
    if (choice === 'saved') {
      // UI obtains informed discard before calling. New server changes are read
      // again rather than adopting an out-of-date review snapshot.
      try {
        const response = await fetch(`/api/note/${remote!.id}`, {
          cache: 'no-store',
        })
        if (!response.ok) {
          if (response.status === 404) {
            this.record.unavailable = true
            this.record.conflict = undefined
            this.publish({syncStatus: 'unavailable', conflict: undefined})
            await this.persist()
          } else {
            this.publish({
              remoteCheckFailed: true,
              ...(response.status === 401 || response.status === 403
                ? {syncStatus: 'unauthenticated' as const}
                : {}),
            })
          }
          return
        }
        const latest = (await response.json()) as Note
        if (latest.revision !== shownRevision) {
          this.record.conflict = latest
          this.publish({conflict: latest})
          await this.persist()
          return
        }
        this.record.baseline = latest
        this.record.conflict = undefined
        this.record.flight = undefined
        this.replaceContent(latest)
        this.publish({
          baseline: latest,
          conflict: undefined,
          syncStatus: 'saved',
        })
        await this.persist()
        await this.localWrites
        await this.io.clear(this.record.id, this.record.generation)
      } catch {
        this.publish({syncStatus: 'failed'})
      }
      return
    }
    this.record.conflict = undefined
    this.record.unavailable = false
    this.record.flight = undefined
    if (choice === 'both') {
      this.record.noteId = null
      this.record.creationId = crypto.randomUUID()
      this.record.baseline = {}
    } else this.record.baseline = remote!
    this.publish({
      baseline: this.record.baseline,
      conflict: undefined,
      syncStatus: 'pending',
    })
    await this.persist()
    await this.flush('save', true)
  }
  async leave(kind: 'save' | 'trash', onSuccess: () => void | Promise<void>) {
    if (this.state.operation || this.stopped) return
    this.publish({operation: kind, error: undefined})
    await this.flush(kind, true)
    // A late IME commit during the first request goes through the same queue.
    if (kind === 'save' && this.dirty && !this.blocked && !this.failures)
      await this.flush('save', true)
    // If an earlier ambiguous save completed first, Trash must run afterwards.
    if (
      kind === 'trash' &&
      !this.record.baseline.pendingDeleteAt &&
      !this.blocked &&
      !this.failures
    )
      await this.flush('trash', true)
    const empty =
      !this.record.noteId &&
      !this.record.flight &&
      !meaningfulContent(this.record.draft)
    const safe =
      empty || !this.dirty || (kind === 'save' && (await this.persist()))
    if ((kind === 'trash' && !this.record.baseline.pendingDeleteAt) || !safe) {
      this.publish({operation: undefined, error: kind})
      return
    }
    await onSuccess()
    if (usePersistStore.getState().noteSession?.identity === this.record.id)
      usePersistStore.getState().setMutateNoteData(undefined)
    this.publish({operation: undefined})
    if (!this.dirty || empty) {
      if (empty)
        await this.io
          .clear(this.record.id, this.record.generation)
          .catch(() => {})
      this.stop()
    }
    window.dispatchEvent(new Event('note-list-stale'))
  }
  retry() {
    if (
      ['unauthenticated', 'invalid_input', 'account_changed'].includes(
        this.state.syncStatus ?? '',
      )
    )
      this.publish({syncStatus: 'pending'})
    return this.flush('save', true)
  }
  stop() {
    this.stopped = true
    this.unsubscribe()
    controllers.delete(this.record.id)
    if (this.localTimer) clearTimeout(this.localTimer)
    if (this.serverTimer) clearTimeout(this.serverTimer)
  }
  async drained() {
    await this.running
    await this.refreshing
    await this.localWrites
  }
  async detach() {
    this.unsubscribe()
    if (this.localTimer) clearTimeout(this.localTimer)
    if (this.serverTimer) clearTimeout(this.serverTimer)
    if (this.dirty) await this.persist()
    this.stop()
  }
}

export function beginNoteSync(
  ownerId: string,
  key: string,
  note?: Note,
  recovery?: RecoveryDraft,
  skipStored = false,
) {
  const current = usePersistStore.getState()
  // An autosaved creation can move to its full route without a new session.
  if (
    !recovery &&
    !skipStored &&
    note &&
    current.noteSession &&
    current.noteSession.baseline.id === note.id &&
    current.noteSession.baseline.authorId === ownerId
  ) {
    usePersistStore.setState({noteSession: {...current.noteSession, key}})
    return
  }
  if (
    !recovery &&
    !skipStored &&
    current.noteSession?.key === key &&
    getNoteSync()?.record.ownerId === ownerId
  )
    return
  const previous = getNoteSync()
  // A closed view may leave a retrying controller alive. Stop it before
  // transferring its recovery copy so it cannot write the retired copy back.
  const source = recovery ? controllers.get(recovery.id) : undefined
  const resuming = source?.record.ownerId === ownerId ? source : undefined
  if (previous && previous !== resuming) void previous.detach()
  resuming?.stop()
  // A version choice can keep the route key while replacing the session.
  // Give the replacement a fresh identity so draining the old controller
  // cannot stop or overwrite it.
  if (current.noteSession?.key === key) current.setMutateNoteData(undefined)
  current.beginNoteSession(key, note)
  const session = usePersistStore.getState().noteSession!
  const controller = new NoteSyncSession(
    ownerId,
    session,
    usePersistStore.getState().mutateNoteData,
  )
  void (async () => {
    await resuming?.drained()
    const recovered =
      resuming &&
      recovery &&
      resuming.record.generation >= recovery.generation &&
      resuming.record.updatedAt >= recovery.updatedAt
        ? structuredClone(resuming.record)
        : recovery
    await controller.hydrate(recovered, skipStored)
  })()
}

export async function persistCurrentDraft() {
  return getNoteSync()?.persist() ?? true
}

export async function discardCapturedDrafts(
  ownerId: string,
  records: RecoveryDraft[],
) {
  const captured: RecoveryDraft[] = []
  let newer = 0
  for (const record of records) {
    if (record.ownerId !== ownerId) continue
    const source = controllers.get(record.id)
    if (
      source &&
      (source.record.ownerId !== ownerId ||
        source.record.generation !== record.generation ||
        !sameRecoveryCopy(source.record, record))
    ) {
      newer++
      continue
    }
    if (source) {
      source.stop()
      await source.drained()
    }
    captured.push(record)
  }
  const result = await clearDraftBatch(ownerId, captured)
  return {newer: newer + result.newer}
}
export function flushVisibleDrafts() {
  return Promise.all(
    [...controllers.values()]
      .filter((controller) => !controller.blocked && controller.dirty)
      .map((controller) => controller.retry()),
  )
}
export function hasUnsafeDraft() {
  return [...controllers.values()].some(
    (controller) => controller.dirty && !controller.localSafe,
  )
}

export async function pauseAccountDrafts(ownerId: string) {
  const owned = [...controllers.values()].filter(
    (controller) => controller.record.ownerId === ownerId,
  )
  const checkpoints = await Promise.all(
    owned.map((controller) => (controller.dirty ? controller.persist() : true)),
  )
  const latest = [...controllers.values()].filter(
    (controller) => controller.record.ownerId === ownerId,
  )
  if (
    checkpoints.some((safe) => !safe) ||
    latest.some((controller) => controller.dirty && !controller.localSafe)
  )
    return false
  for (const controller of latest) controller.stop()
  usePersistStore.getState().setMutateNoteData(undefined)
  return true
}
export async function discardAccountMemory(ownerId: string) {
  for (const [id, controller] of controllers)
    if (controller.record.ownerId === ownerId) {
      controller.stop()
      await controller.drained()
      controllers.delete(id)
    }
  usePersistStore.getState().setMutateNoteData(undefined)
}

export async function removeAccountRecovery(ownerId: string) {
  await discardAccountMemory(ownerId)
  await clearAccountDrafts(ownerId)
}

export async function requestAccountExit(): Promise<boolean> {
  if (!account) return true
  const controller = getNoteSync()
  const durable = !controller?.dirty || (await controller.persist())
  try {
    const drafts = await listDrafts(account)
    if (!drafts.length && durable) return true
    return await new Promise<boolean>((resolve) =>
      window.dispatchEvent(
        new CustomEvent('note-account-exit', {
          detail: {ownerId: account, resolve},
        }),
      ),
    )
  } catch {
    return await new Promise<boolean>((resolve) =>
      window.dispatchEvent(
        new CustomEvent('note-account-exit', {
          detail: {ownerId: account, resolve},
        }),
      ),
    )
  }
}
