import {isAppearancePreference, type AppearancePreference} from './appearance'

export type AppearanceSyncStatus =
  'local' | 'syncing' | 'synced' | 'offline' | 'error'
export type AppearanceCache = AppearancePreference & {
  id: string
  pending: boolean
}

export function isAppearanceCache(value: unknown): value is AppearanceCache {
  return (
    isAppearancePreference(value) &&
    'id' in value &&
    typeof value.id === 'string' &&
    'pending' in value &&
    typeof value.pending === 'boolean'
  )
}

type SyncOptions = {
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
  online: () => boolean
  newId: () => string
}

/** One serialized queue per signed-in account. Remote reads never discard pending edits. */
export function createAppearanceSync(options: SyncOptions) {
  let stopped = false
  let running: Promise<void> | null = null
  let again = false
  const cached = options.readCache()
  if (cached) options.apply(cached)

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
    const entry = {...value, pending, id: options.newId()}
    options.writeCache(entry)
    return entry
  }

  async function reconcile() {
    do {
      again = false
      if (!options.online()) {
        options.status('offline')
        return
      }
      options.status('syncing')
      const pending = options.readCache()
      let remote: AppearancePreference | null
      if (pending?.pending) {
        remote = await options.writeRemote(pending, false)
        if (stopped) return
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
          remote = await options.writeRemote(options.current(), true)
          if (stopped) return
          if (
            options.readCache()?.id !== pending?.id ||
            options.readCache()?.pending
          ) {
            again = true
            continue
          }
        }
      }
      remember(remote, false)
      options.apply(remote)
      options.status('synced')
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
        if (!stopped) options.status(options.online() ? 'error' : 'offline')
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
      remember(value, true)
      void sync()
    },
    stop() {
      stopped = true
    },
  }
}
