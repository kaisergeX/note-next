'use client'

import {useSyncExternalStore} from 'react'
import type {VaultAuthorization} from './authorization'
import type {VaultWrapper} from './protocol'

export type ConfirmedVault = {
  id: string
  ownerId: string
  revision: string
  setupId: string
  lastOperationId: string
  authorizationVersion?: 0 | 1
  authorization?: VaultAuthorization | null
  primaryWrapper: VaultWrapper
  recoveryWrapper: VaultWrapper
}

type State = 'locked' | 'unlocked' | 'locking' | 'blocked'
let epoch = 0
let session: {ownerId: string; vaultId: string; root: CryptoKey} | null = null
const pendingLocks = new Map<string, Promise<boolean>>()
const blockedCheckpoints = new Map<string, (() => Promise<void>)[]>()
const listeners = new Set<() => void>()
const checkpoints = new Map<() => Promise<void>, string>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
function publish() {
  for (const listener of listeners) listener()
}

export const currentVaultEpoch = () => epoch
export function activateVault(
  ownerId: string,
  vaultId: string,
  root: CryptoKey,
  expectedEpoch: number,
) {
  if (
    expectedEpoch !== epoch ||
    document.hidden ||
    pendingLocks.has(ownerId) ||
    blockedCheckpoints.has(ownerId) ||
    (session && (session.ownerId !== ownerId || session.vaultId !== vaultId))
  )
    throw new Error('Unlock expired')
  // Re-verifying credentials for this already active vault must not invalidate
  // the editor's captured epoch or replace its non-extractable root reference.
  if (session) return
  epoch++
  session = {ownerId, vaultId, root}
  publish()
}
export function getVaultRoot(ownerId: string, vaultId: string) {
  return session?.ownerId === ownerId && session.vaultId === vaultId
    ? session.root
    : null
}
export function useVaultUnlocked(ownerId: string, vaultId: string) {
  return useSyncExternalStore(
    subscribe,
    () => Boolean(getVaultRoot(ownerId, vaultId)),
    () => false,
  )
}
export function useLockState(ownerId: string) {
  return useSyncExternalStore(
    subscribe,
    (): State => {
      if (pendingLocks.has(ownerId)) return 'locking'
      if (blockedCheckpoints.has(ownerId)) return 'blocked'
      return session?.ownerId === ownerId ? 'unlocked' : 'locked'
    },
    () => 'locked' as State,
  )
}
export function registerVaultCheckpoint(
  ownerId: string,
  flush: () => Promise<void>,
) {
  checkpoints.set(flush, ownerId)
  return () => {
    checkpoints.delete(flush)
  }
}
export function lockVault(ownerId: string, broadcast = true): Promise<boolean> {
  if (broadcast && typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        'eton-vault-lock',
        JSON.stringify([ownerId, crypto.randomUUID()]),
      )
    } catch {
      /* Storage may be unavailable. */
    }
  }
  const pending = pendingLocks.get(ownerId)
  if (pending) return pending
  if (!session || session.ownerId === ownerId) {
    epoch++
    session = null
  }
  // Capture callbacks before subscribers unmount the editing surface. Each
  // callback retains the key needed to seal its own draft after locking.
  const tasks =
    blockedCheckpoints.get(ownerId) ??
    [...checkpoints]
      .filter(([, owner]) => owner === ownerId)
      .map(([flush]) => flush)
  const lock = Promise.allSettled(
    tasks.map((flush) => Promise.resolve().then(flush)),
  ).then((results) => {
    const failed = tasks.filter((task, index) => {
      if (results[index].status === 'rejected') return true
      checkpoints.delete(task)
      return false
    })
    if (failed.length) blockedCheckpoints.set(ownerId, failed)
    else blockedCheckpoints.delete(ownerId)
    pendingLocks.delete(ownerId)
    publish()
    return failed.length === 0
  })
  pendingLocks.set(ownerId, lock)
  if (typeof window !== 'undefined')
    window.dispatchEvent(
      new CustomEvent('eton-vault-invalidated', {detail: ownerId}),
    )
  publish()
  return lock
}
export function discardBlockedEdits(ownerId: string) {
  const blocked = blockedCheckpoints.get(ownerId)
  if (!blocked || pendingLocks.has(ownerId)) return
  if (!session) epoch++
  for (const task of blocked) checkpoints.delete(task)
  blockedCheckpoints.delete(ownerId)
  publish()
}
export function installVaultLifecycle(ownerId: string) {
  let idle: ReturnType<typeof setTimeout>
  const lockHere = () => {
    void lockVault(ownerId, false)
  }
  const activity = () => {
    clearTimeout(idle)
    idle = setTimeout(lockHere, 15 * 60_000)
  }
  const visibility = () => {
    if (document.hidden) lockHere()
    else activity()
  }
  const restored = (event: PageTransitionEvent) => {
    if (event.persisted) lockHere()
  }
  const sibling = (event: StorageEvent) => {
    if (event.key !== 'eton-vault-lock' || !event.newValue) return
    try {
      if (JSON.parse(event.newValue)[0] === ownerId) lockHere()
    } catch {
      /* Ignore malformed events. */
    }
  }
  activity()
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('pagehide', lockHere)
  window.addEventListener('pageshow', restored)
  window.addEventListener('storage', sibling)
  window.addEventListener('pointerdown', activity)
  window.addEventListener('keydown', activity)
  window.addEventListener('input', activity)
  return () => {
    clearTimeout(idle)
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('pagehide', lockHere)
    window.removeEventListener('pageshow', restored)
    window.removeEventListener('storage', sibling)
    window.removeEventListener('pointerdown', activity)
    window.removeEventListener('keydown', activity)
    window.removeEventListener('input', activity)
    lockHere()
  }
}
