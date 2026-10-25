import {isAppearancePreference, type AppearancePreference} from './appearance'

export type AppearanceSyncStatus =
  'local' | 'pending' | 'syncing' | 'synced' | 'offline' | 'error'
export type AppearanceCache = AppearancePreference & {
  id: string
  pending: boolean
  saveAfter?: number
}

export function isAppearanceCache(value: unknown): value is AppearanceCache {
  return (
    isAppearancePreference(value) &&
    'id' in value &&
    typeof value.id === 'string' &&
    'pending' in value &&
    typeof value.pending === 'boolean' &&
    (!('saveAfter' in value) ||
      (typeof value.saveAfter === 'number' && Number.isFinite(value.saveAfter)))
  )
}

type SyncOptions = {
  saveDelayMs?: number
  current: () => AppearancePreference
  apply: (value: AppearancePreference) => void
  readCache: () => AppearanceCache | null
  writeCache: (value: AppearanceCache) => void
  readRemote: () => Promise<AppearancePreference | null>
  writeRemote: (
    value: AppearancePreference,
    initialize: boolean,
  ) => Promise<AppearancePreference>
  status: (value: AppearanceSyncStatus) => void
  saved?: () => void
  online: () => boolean
  newId: () => string
}

/** One serialized queue per signed-in account. Remote reads never discard pending edits. */
export function createAppearanceSync(options: SyncOptions) {
  let stopped = false
  let running: Promise<void> | null = null
  let again = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let writing = false
  const cached = options.readCache()
  let lastSaved: AppearancePreference | null =
    cached && !cached.pending ? cached : null
  if (cached) options.apply(cached)

  function same(a: AppearancePreference, b: AppearancePreference) {
    return a.appearance === b.appearance && a.mode === b.mode
  }

  function remember(value: AppearancePreference, pending: boolean) {
    const previous = options.readCache()
    // Avoid bouncing unchanged remote preferences between open tabs.
    if (
      !pending &&
      previous &&
      !previous.pending &&
      previous.appearance === value.appearance &&
      previous.mode === value.mode
    ) {
      return previous
    }
    const entry: AppearanceCache = {
      appearance: value.appearance,
      mode: value.mode,
      pending,
      id: options.newId(),
      ...(pending
        ? {saveAfter: Date.now() + (options.saveDelayMs ?? 1500)}
        : {}),
    }
    options.writeCache(entry)
    return entry
  }

  async function reconcile() {
    do {
      again = false
      clearTimeout(timer)
      timer = undefined
      if (!options.online()) {
        options.status('offline')
        return
      }
      const pending = options.readCache()
      const remaining = (pending?.saveAfter ?? 0) - Date.now()
      if (pending?.pending && remaining > 0) {
        options.status('pending')
        // Share the deadline through the cache so other tabs and focus events
        // cannot flush the preview before the user has stopped selecting.
        timer = setTimeout(() => {
          timer = undefined
          void sync()
        }, remaining)
        return
      }
      let remote: AppearancePreference | null
      let didSave = false
      if (pending?.pending) {
        options.status('syncing')
        writing = true
        try {
          remote = await options.writeRemote(pending, false)
        } finally {
          writing = false
        }
        if (stopped) return
        didSave = true
        lastSaved = remote
        // A newer local/tab edit may have arrived while the save was in flight.
        if (options.readCache()?.id !== pending.id) {
          again = true
          continue
        }
      } else {
        remote = await options.readRemote()
        if (stopped) return
        if (
          options.readCache()?.id !== pending?.id ||
          options.readCache()?.pending
        ) {
          again = true
          continue
        }
        if (!remote) {
          options.status('syncing')
          writing = true
          try {
            remote = await options.writeRemote(options.current(), true)
          } finally {
            writing = false
          }
          if (stopped) return
          didSave = true
          if (
            options.readCache()?.id !== pending?.id ||
            options.readCache()?.pending
          ) {
            again = true
            continue
          }
        }
      }
      lastSaved = remote
      remember(remote, false)
      options.apply(remote)
      options.status('synced')
      if (didSave) options.saved?.()
    } while (again && !stopped)
  }

  function sync(): Promise<void> {
    if (stopped) return Promise.resolve()
    if (running) {
      again = true
      return running
    }
    running = reconcile()
      .catch(() => {
        if (!stopped && !timer)
          options.status(options.online() ? 'error' : 'offline')
      })
      .finally(() => {
        running = null
      })
    return running
  }

  return {
    sync,
    change(value: AppearancePreference) {
      if (stopped) return
      const previous = options.readCache()
      if (previous && same(previous, value)) return
      clearTimeout(timer)
      timer = undefined
      if (!writing && lastSaved && same(lastSaved, value)) {
        remember(value, false)
        options.status(options.online() ? 'synced' : 'offline')
        return
      }
      remember(value, true)
      options.status(options.online() ? 'pending' : 'offline')
      // A read or save already in flight must also respect the new deadline.
      const remaining = options.saveDelayMs ?? 1500
      if (remaining > 0 && options.online()) {
        timer = setTimeout(() => {
          timer = undefined
          void sync()
        }, remaining)
      }
      void sync()
    },
    stop() {
      stopped = true
      clearTimeout(timer)
    },
  }
}
