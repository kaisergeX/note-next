'use client'

import {useEffect, useState} from 'react'
import {usePersistStore} from '~/store'
import {listDrafts, type RecoveryDraft} from './drafts'

export function useRecoveryDrafts(ownerId: string) {
  const [state, setState] = useState<{
    ownerId: string
    records: RecoveryDraft[]
    error: boolean
    loaded: boolean
  }>({ownerId, records: [], error: false, loaded: false})
  const activeId = usePersistStore((s) => s.noteSession?.identity)
  useEffect(() => {
    let alive = true
    const load = () =>
      void listDrafts(ownerId).then(
        (records) => {
          if (alive) setState({ownerId, records, error: false, loaded: true})
        },
        () => {
          if (alive)
            setState((previous) => ({
              ownerId,
              records: previous.ownerId === ownerId ? previous.records : [],
              error: true,
              loaded: true,
            }))
        },
      )
    load()
    const channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel('eton-note-recovery')
        : undefined
    if (channel) channel.onmessage = load
    window.addEventListener('note-recovery-changed', load)
    window.addEventListener('focus', load)
    return () => {
      alive = false
      channel?.close()
      window.removeEventListener('note-recovery-changed', load)
      window.removeEventListener('focus', load)
    }
  }, [ownerId])
  if (state.ownerId !== ownerId)
    return {records: [], error: false, loaded: false}
  return {
    ...state,
    records: state.records.filter((record) => record.id !== activeId),
  }
}
