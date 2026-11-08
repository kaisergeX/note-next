'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type Dispatch,
  type SetStateAction,
} from 'react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import type {VirtualItem} from '@tanstack/react-virtual'
import type {Note} from '~/db/schema/notes'
import type {NoteAcknowledgement} from '~/lib/notes/search-reconciliation'
import {usePathname} from '~/i18n/navigation'
import {
  cancelNoteListTransition,
  startNoteListTransition,
} from '~/lib/notes/transitions'

type ListPosition =
  | {
      id: string
      top: number
      browserWorkOnly: boolean
      search?: string
      departed?: boolean
    }
  | undefined
const NoteListPosition = createContext<RefObject<ListPosition>>({
  current: undefined,
})
export const useNoteListPosition = () => useContext(NoteListPosition)
const MasonryCache = createContext(new Map<string, VirtualItem[]>())
export const useNoteMasonryCache = () => useContext(MasonryCache)
const NativeMasonryCache = createContext(new Map<string, number>())
export const useNativeMasonryCache = () => useContext(NativeMasonryCache)
type CollectionState = {
  search: string
  filter: 'all' | 'review'
  acknowledged: Record<string, NoteAcknowledgement>
}
const NoteCollectionState = createContext<
  [CollectionState, Dispatch<SetStateAction<CollectionState>>] | null
>(null)
export const useNoteCollectionState = () => useContext(NoteCollectionState)!

export default function NoteQueryProvider({
  children,
  ownerId,
}: {
  children: ReactNode
  ownerId: string
}) {
  const position = useRef<ListPosition>(undefined)
  const pathname = usePathname()
  useEffect(() => {
    if (
      position.current &&
      pathname !== '/eton' &&
      pathname !== '/collection/browser-work'
    )
      position.current.departed = true
  }, [pathname])
  const collection = useState<CollectionState>({
    search: '',
    filter: 'all',
    acknowledged: {},
  })
  const setCollection = collection[1]
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
      const note = (event as CustomEvent<Note>).detail
      const recordedAt = Date.now()
      if (note.authorId !== ownerId) return
      startNoteListTransition(() => {
        setCollection((previous) => ({
          ...previous,
          acknowledged: {
            ...previous.acknowledged,
            [note.id]: {note, recordedAt},
          },
        }))
        void client.invalidateQueries()
      }, transitionKey)
    }
    window.addEventListener('note-list-stale', refresh)
    window.addEventListener('note-saved', saved)
    return () => {
      window.removeEventListener('note-list-stale', refresh)
      window.removeEventListener('note-saved', saved)
      cancelNoteListTransition(transitionKey)
    }
  }, [client, ownerId, setCollection])
  return (
    <QueryClientProvider client={client}>
      <MasonryCache value={masonryCache}>
        <NativeMasonryCache value={nativeMasonryCache}>
          <NoteCollectionState value={collection}>
            <NoteListPosition value={position}>{children}</NoteListPosition>
          </NoteCollectionState>
        </NativeMasonryCache>
      </MasonryCache>
    </QueryClientProvider>
  )
}
