'use client'

import {useEffect, useMemo, useRef, useState} from 'react'
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import type {NoteCursor, NotePage, NotePreview} from './pages'
import {recoveryNoteId} from './recovery-copies'
import type {RecoveryDraft} from './drafts'
import {cancelNoteListTransition, startNoteListTransition} from './transitions'

async function readOwned<T>(ownerId: string, response: Response): Promise<T> {
  if (!response.ok) throw new Error('Could not load notes')
  const data = await response.json()
  if (data.ownerId !== ownerId) throw new Error('Account changed')
  return data
}

export function useNotePages(
  ownerId: string,
  initialPage: NotePage | undefined,
  records: RecoveryDraft[],
) {
  const client = useQueryClient()
  const queryKey = useMemo(() => ['note-pages', ownerId], [ownerId])
  const query = useInfiniteQuery({
    queryKey,
    gcTime: Infinity,
    enabled: Boolean(initialPage),
    initialPageParam: null as NoteCursor | null,
    queryFn: async ({pageParam, signal}) =>
      readOwned<NotePage>(
        ownerId,
        await fetch(
          `/api/note${pageParam ? `?cursor=${encodeURIComponent(JSON.stringify(pageParam))}` : ''}`,
          {cache: 'no-store', signal},
        ),
      ),
    getNextPageParam: (page) => page.nextCursor,
    initialData: initialPage
      ? {pages: [initialPage], pageParams: [null]}
      : undefined,
  })
  const previous = useRef<NotePage | undefined>(undefined)
  useEffect(() => {
    // Route refreshes must refresh every loaded page without discarding the tail.
    if (previous.current === initialPage) return
    previous.current = initialPage
    if (
      client.getQueryData<InfiniteData<NotePage>>(queryKey)?.pages[0] ===
      initialPage
    )
      return
    void client.invalidateQueries({queryKey})
    void client.invalidateQueries({queryKey: ['note-identities', ownerId]})
  }, [client, initialPage, queryKey, ownerId])
  const ids = [...new Set(records.map(recoveryNoteId))].sort()
  const identities = useQuery({
    queryKey: ['note-identities', ownerId, ids],
    enabled: ids.length > 0,
    refetchOnMount: 'always',
    queryFn: async ({signal}) => {
      const notes: NotePreview[] = []
      for (let index = 0; index < ids.length; index += 100) {
        const result = await readOwned<{notes: NotePreview[]}>(
          ownerId,
          await fetch('/api/note', {
            method: 'POST',
            cache: 'no-store',
            signal,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(ids.slice(index, index + 100)),
          }),
        )
        notes.push(...result.notes)
      }
      return notes
    },
  })
  const fetchedNotes = useMemo(() => {
    const byId = new Map<string, NotePreview>()
    for (const note of [
      ...(identities.data ?? []),
      ...(query.data?.pages.flatMap((page) => page.notes) ?? []),
    ])
      if (note.authorId === ownerId) byId.set(note.id, note)
    return [...byId.values()]
  }, [identities.data, query.data, ownerId])
  // Query notifications use an external store. Publish visible list changes
  // through React so they respect the existing dialog and view transitions.
  const [shown, setShown] = useState({ownerId, notes: fetchedNotes})
  useEffect(() => {
    const transitionKey = {}
    startNoteListTransition(
      () => setShown({ownerId, notes: fetchedNotes}),
      transitionKey,
    )
    return () => cancelNoteListTransition(transitionKey)
  }, [fetchedNotes, ownerId])
  return {
    query,
    identities,
    notes: shown.ownerId === ownerId ? shown.notes : [],
    pagesSettled: shown.notes === fetchedNotes,
  }
}
