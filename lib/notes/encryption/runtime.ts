'use client'

import {useSyncExternalStore} from 'react'
import type {VaultWrapper} from './protocol'

export type ConfirmedVault = {
  id: string
  ownerId: string
  revision: string
  setupId: string
  lastOperationId: string
  primaryWrapper: VaultWrapper
  recoveryWrapper: VaultWrapper
}

type State = 'locked' | 'unlocked' | 'locking' | 'blocked'
let state: State = 'locked'
let epoch = 0
let session: {ownerId: string; vaultId: string; root: CryptoKey} | null = null
let pending: Promise<boolean> | null = null
let lockingOwner: string | null = null
let blocked: (() => Promise<void>)[] = []
const listeners = new Set<() => void>()
const checkpoints = new Map<() => Promise<void>, string>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
function publish(next: State) {
  state = next
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
    pending ||
    state === 'blocked' ||
    (session && (session.ownerId !== ownerId || session.vaultId !== vaultId))
  )
    throw new Error('Unlock expired')
  // Re-verifying credentials for this already active vault must not invalidate
  // the editor's captured epoch or replace its non-extractable root reference.
  if (state === 'unlocked' && session) return
  epoch++
  session = {ownerId, vaultId, root}
  publish('unlocked')
}
export function getVaultRoot(ownerId: string, vaultId: string) {
  return state === 'unlocked' &&
    session?.ownerId === ownerId &&
    session.vaultId === vaultId
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
    () => (lockingOwner === ownerId ? state : 'locked'),
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
  if (session && session.ownerId !== ownerId) return Promise.resolve(true)
  if (pending) return pending
  epoch++
  if (typeof window !== 'undefined')
    window.dispatchEvent(
      new CustomEvent('eton-vault-invalidated', {detail: ownerId}),
    )
  lockingOwner = ownerId
  const tasks =
    state === 'blocked'
      ? blocked
      : [...checkpoints]
          .filter(([, owner]) => owner === ownerId)
          .map(([flush]) => flush)
  // Capture callbacks before subscribers unmount the editing surface.
  publish('locking')
  pending = Promise.allSettled(
    tasks.map((flush) => Promise.resolve().then(flush)),
  )
    .then((results) => {
      blocked = tasks.filter((task, index) => {
        if (results[index].status === 'rejected') return true
        checkpoints.delete(task)
        return false
      })
      if (blocked.length) {
        publish('blocked')
        return false
      }
      session = null
      publish('locked')
      return true
    })
    .finally(() => {
      pending = null
    })
  return pending
}
export function discardBlockedEdits(ownerId: string) {
  if (lockingOwner !== ownerId || state !== 'blocked') return
  epoch++
  session = null
  for (const task of blocked) checkpoints.delete(task)
  blocked = []
  publish('locked')
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
