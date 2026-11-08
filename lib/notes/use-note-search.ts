'use client'

import {useEffect, useMemo, useState} from 'react'
import {useInfiniteQuery} from '@tanstack/react-query'
import type {NoteCursor} from './pages'
import {foldSearchText, type NoteSearchMatch} from './search'
import {noteSearchKey, readNoteSearchPage} from './search-client'
import {cancelNoteListTransition, startNoteListTransition} from './transitions'

export function useNoteSearch(
  ownerId: string,
  value: string,
  composing = false,
) {
  const term = foldSearchText(value)
  const [settled, setSettled] = useState({ownerId, term})
  useEffect(() => {
    if (composing) return
    const timer = setTimeout(() => setSettled({ownerId, term}), 200)
    return () => clearTimeout(timer)
  }, [ownerId, term, composing])
  const waiting =
    composing || settled.ownerId !== ownerId || settled.term !== term
  const active = Boolean(term)
  const query = useInfiniteQuery({
    queryKey: noteSearchKey(ownerId, settled.term),
    enabled: active && !waiting,
    initialPageParam: null as NoteCursor | null,
    queryFn: ({pageParam, signal}) =>
      readNoteSearchPage(ownerId, settled.term, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor,
    refetchOnMount: 'always',
  })
  const fetched = useMemo(
    () => query.data?.pages.flatMap((page) => page.notes) ?? [],
    [query.data],
  )
  // Publish external query updates through the existing list transition so a
  // dialog can finish closing before its background search cards move.
  const [shown, setShown] = useState<{
    ownerId: string
    term: string
    notes: NoteSearchMatch[]
  }>({ownerId, term: settled.term, notes: fetched})
  useEffect(() => {
    const key = {}
    startNoteListTransition(
      () => setShown({ownerId, term: settled.term, notes: fetched}),
      key,
    )
    return () => cancelNoteListTransition(key)
  }, [ownerId, settled.term, fetched])
  const notes =
    active && !waiting && shown.ownerId === ownerId && shown.term === term
      ? shown.notes
      : []
  const pagesSettled = shown.notes === fetched && shown.term === term
  return {
    query,
    notes,
    active,
    pending:
      active &&
      (waiting || query.isPending || query.isFetching || !pagesSettled),
    complete:
      active &&
      !waiting &&
      pagesSettled &&
      query.isSuccess &&
      !query.isFetching &&
      !query.hasNextPage,
    error: active && !waiting ? query.error : null,
    pagesSettled,
  }
}
