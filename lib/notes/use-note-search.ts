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
    const timer = setTimeout(() => setSettled({ownerId, term}), 300)
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
  }>({ownerId, term: query.isSuccess ? settled.term : '', notes: fetched})
  useEffect(() => {
    if (active && (waiting || !query.isSuccess || query.isFetching)) return
    const key = {}
    startNoteListTransition(
      () =>
        setShown((previous) => {
          const nextTerm = active ? settled.term : ''
          const nextNotes = active ? fetched : []
          return previous.ownerId === ownerId &&
            previous.term === nextTerm &&
            (active
              ? previous.notes === nextNotes
              : previous.notes.length === 0)
            ? previous
            : {ownerId, term: nextTerm, notes: nextNotes}
        }),
      key,
    )
    return () => cancelNoteListTransition(key)
  }, [
    ownerId,
    settled.term,
    fetched,
    active,
    waiting,
    query.isSuccess,
    query.isFetching,
  ])
  const displayTerm = shown.ownerId === ownerId ? shown.term : ''
  const notes = shown.ownerId === ownerId ? shown.notes : []
  const pagesSettled =
    !waiting &&
    shown.ownerId === ownerId &&
    shown.notes === fetched &&
    shown.term === term
  return {
    query,
    notes,
    active,
    displayTerm,
    fetching: active && !waiting && query.isFetching,
    pending:
      displayTerm !== term ||
      (active &&
        (waiting || query.isPending || query.isFetching || !pagesSettled)),
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
