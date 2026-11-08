'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import type {VirtualItem} from '@tanstack/react-virtual'
import type {Note} from '~/db/schema/notes'
import {
  cancelNoteListTransition,
  startNoteListTransition,
} from '~/lib/notes/transitions'

type ListPosition =
  {id: string; top: number; browserWorkOnly: boolean} | undefined
const NoteListPosition = createContext<RefObject<ListPosition>>({
  current: undefined,
})
export const useNoteListPosition = () => useContext(NoteListPosition)
const MasonryCache = createContext(new Map<string, VirtualItem[]>())
export const useNoteMasonryCache = () => useContext(MasonryCache)
const NativeMasonryCache = createContext(new Map<string, number>())
export const useNativeMasonryCache = () => useContext(NativeMasonryCache)

export default function NoteQueryProvider({
  children,
  ownerId,
}: {
  children: ReactNode
  ownerId: string
}) {
  const position = useRef<ListPosition>(undefined)
  const [masonryCache] = useState(() => new Map<string, VirtualItem[]>())
  const [nativeMasonryCache] = useState(() => new Map<string, number>())
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity,
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )
  useEffect(() => {
    const transitionKey = {}
    const refresh = () => {
      startNoteListTransition(() => {
        void client.invalidateQueries()
      }, transitionKey)
    }
    const saved = (event: Event) => {
      if ((event as CustomEvent<Note>).detail.authorId === ownerId) refresh()
    }
    window.addEventListener('note-list-stale', refresh)
    window.addEventListener('note-saved', saved)
    return () => {
      window.removeEventListener('note-list-stale', refresh)
      window.removeEventListener('note-saved', saved)
      cancelNoteListTransition(transitionKey)
    }
  }, [client, ownerId])
  return (
    <QueryClientProvider client={client}>
      <MasonryCache value={masonryCache}>
        <NativeMasonryCache value={nativeMasonryCache}>
          <NoteListPosition value={position}>{children}</NoteListPosition>
        </NativeMasonryCache>
      </MasonryCache>
    </QueryClientProvider>
  )
}
