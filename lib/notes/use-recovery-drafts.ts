'use client'

import {useEffect, useState} from 'react'
import {usePersistStore} from '~/store'
import {listDrafts, type RecoveryDraft} from './drafts'
import {groupRecoveryDrafts} from './recovery-copies'
import {cancelNoteListTransition, startNoteListTransition} from './transitions'

export function useRecoveryDrafts(
  ownerId: string,
  includeActive = false,
  animateList = false,
) {
  const [state, setState] = useState<{
    ownerId: string
    records: RecoveryDraft[]
    error: boolean
    loaded: boolean
  }>({ownerId, records: [], error: false, loaded: false})
  const activeId = usePersistStore((s) => s.noteSession?.identity)
  useEffect(() => {
    let alive = true
    let request = 0
    const transitionKey = {}
    const load = () => {
      const current = ++request
      void listDrafts(ownerId).then(
        (records) => {
          if (alive && current === request) {
            const update = () => {
              if (alive && current === request)
                setState({ownerId, records, error: false, loaded: true})
            }
            if (animateList) startNoteListTransition(update, transitionKey)
            else update()
          }
        },
        () => {
          if (alive && current === request)
            setState((previous) => ({
              ownerId,
              records: previous.ownerId === ownerId ? previous.records : [],
              error: true,
              loaded: true,
            }))
        },
      )
    }
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
      cancelNoteListTransition(transitionKey)
      channel?.close()
      window.removeEventListener('note-recovery-changed', load)
      window.removeEventListener('focus', load)
    }
  }, [ownerId, animateList])
  if (state.ownerId !== ownerId)
    return {records: [], groups: [], error: false, loaded: false}
  const records = state.records.filter(
    (record) => includeActive || record.id !== activeId,
  )
  return {
    ...state,
    records,
    groups: groupRecoveryDrafts(records),
  }
}
