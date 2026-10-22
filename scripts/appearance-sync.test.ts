import assert from 'node:assert/strict'
import {test} from 'node:test'
import {
  createAppearanceSync,
  type AppearanceCache,
  type AppearanceSyncStatus,
} from '../lib/appearance-sync'
import type {AppearancePreference} from '../lib/appearance'

const guest: AppearancePreference = {appearance: 'sepia', mode: 'light'}
const saved: AppearancePreference = {appearance: 'bookish', mode: 'system'}
const next: AppearancePreference = {appearance: 'midnight', mode: 'dark'}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return {promise, resolve}
}

function fixture(initial: AppearanceCache | null = null) {
  let local = guest
  let cache = initial
  let remote: AppearancePreference | null = saved
  let online = true
  let id = 0
  let cacheWrites = 0
  let state: AppearanceSyncStatus = 'local'
  const writes: {value: AppearancePreference; initialize: boolean}[] = []
  const options = {
    current: () => local,
    apply: (value: AppearancePreference) => {
      local = {appearance: value.appearance, mode: value.mode}
    },
    readCache: () => cache,
    writeCache: (value: AppearanceCache) => {
      cache = value
      cacheWrites++
    },
    readRemote: async () => remote,
    writeRemote: async (value: AppearancePreference, initialize: boolean) => {
      writes.push({value, initialize})
      if (!initialize || !remote)
        remote = {appearance: value.appearance, mode: value.mode}
      return remote
    },
    status: (value: AppearanceSyncStatus) => {
      state = value
    },
    online: () => online,
    newId: () => String(++id),
  }
  return {
    options,
    writes,
    local: () => local,
    cache: () => cache,
    cacheWrites: () => cacheWrites,
    status: () => state,
    setRemote: (value: AppearancePreference | null) => {
      remote = value
    },
    setOnline: (value: boolean) => {
      online = value
    },
  }
}

test('existing account preference replaces guest choice without writing to account', async () => {
  const f = fixture()
  const sync = createAppearanceSync(f.options)
  await sync.sync()
  assert.deepEqual(f.local(), saved)
  assert.equal(f.writes.length, 0)
  assert.equal(f.status(), 'synced')
})

test('account with no preference initializes from guest choice', async () => {
  const f = fixture()
  f.setRemote(null)
  await createAppearanceSync(f.options).sync()
  assert.deepEqual(f.local(), guest)
  assert.equal(f.writes[0].initialize, true)
  assert.deepEqual(f.writes[0].value, guest)
})

test('another device creating the preference during initialization wins', async () => {
  const f = fixture()
  f.options.readRemote = async () => null
  await createAppearanceSync(f.options).sync()
  assert.deepEqual(f.local(), saved)
  assert.equal(f.writes[0].initialize, true)
})

test('offline edits survive controller restart and save on reconnection', async () => {
  const f = fixture()
  f.setOnline(false)
  const first = createAppearanceSync(f.options)
  first.change(next)
  await first.sync()
  assert.equal(f.cache()?.pending, true)
  assert.equal(f.status(), 'offline')
  first.stop()
  f.setOnline(true)
  await createAppearanceSync(f.options).sync()
  assert.deepEqual(f.local(), next)
  assert.equal(f.cache()?.pending, false)
  assert.equal(f.writes.length, 1)
})

test('a local edit made during remote load is not overwritten by stale response', async () => {
  const f = fixture()
  const response = deferred<AppearancePreference | null>()
  f.options.readRemote = () => response.promise
  const sync = createAppearanceSync(f.options)
  const work = sync.sync()
  sync.change(next)
  response.resolve(saved)
  await work
  assert.deepEqual(f.local(), next)
  assert.equal(f.cache()?.pending, false)
})

test('a newer edit during save is queued and old save cannot clear it', async () => {
  const f = fixture()
  const response = deferred<AppearancePreference>()
  const write = f.options.writeRemote
  let calls = 0
  f.options.writeRemote = (value, initialize) =>
    ++calls === 1 ? response.promise : write(value, initialize)
  const sync = createAppearanceSync(f.options)
  sync.change(guest)
  const work = sync.sync()
  sync.change(next)
  response.resolve(guest)
  await work
  assert.equal(calls, 2)
  assert.deepEqual(f.local(), next)
  assert.equal(f.cache()?.pending, false)
})

test('a delayed read cannot replace a newer preference already saved by another tab', async () => {
  const f = fixture()
  const response = deferred<AppearancePreference | null>()
  let reads = 0
  f.options.readRemote = () =>
    ++reads === 1 ? response.promise : Promise.resolve(next)
  const sync = createAppearanceSync(f.options)
  const work = sync.sync()
  f.options.writeCache({...next, id: 'other-tab', pending: false})
  response.resolve(saved)
  await work
  assert.deepEqual(f.local(), next)
  assert.equal(f.writes.length, 0)
})

test('failed saves retain pending edits for retry', async () => {
  const f = fixture()
  const write = f.options.writeRemote
  f.options.writeRemote = async () => {
    throw new Error('network')
  }
  const sync = createAppearanceSync(f.options)
  sync.change(next)
  await sync.sync()
  assert.equal(f.cache()?.pending, true)
  assert.equal(f.status(), 'error')
  f.options.writeRemote = write
  await sync.sync()
  assert.deepEqual(f.local(), next)
  assert.equal(f.cache()?.pending, false)
})

test('sign-out stops late responses applying another account preference', async () => {
  const f = fixture()
  const response = deferred<AppearancePreference | null>()
  f.options.readRemote = () => response.promise
  const sync = createAppearanceSync(f.options)
  const work = sync.sync()
  sync.stop()
  response.resolve(saved)
  await work
  assert.deepEqual(f.local(), guest)
  assert.equal(f.cache(), null)
})

test('unchanged remote reads do not cause cross-tab storage feedback loops', async () => {
  const f = fixture()
  const sync = createAppearanceSync(f.options)
  await sync.sync()
  const writes = f.cacheWrites()
  await sync.sync()
  await sync.sync()
  assert.equal(f.cacheWrites(), writes)
})

test('pending account A edits cannot be written by an account B controller', async () => {
  const a = fixture({...next, pending: true, id: 'account-a'})
  const b = fixture()
  a.setOnline(false)
  const first = createAppearanceSync(a.options)
  await first.sync()
  first.stop()
  await createAppearanceSync(b.options).sync()
  assert.equal(a.cache()?.pending, true)
  assert.equal(b.writes.length, 0)
  assert.deepEqual(b.local(), saved)
})
