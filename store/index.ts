import {create} from 'zustand'
import {persist} from 'zustand/middleware'
import type {PersistedStore} from '~/types/store'
import {createSystemSlice} from './system'
import {createNoteSlice} from './note'

// Listen Storage changes and rehydrate store
export const withStorageDOMEvents = (store: typeof usePersistStore) => {
  const storageEventCallback = (e: StorageEvent) => {
    if (e.key === store.persist.getOptions().name && e.newValue) {
      void store.persist.rehydrate()
    }
  }

  window.addEventListener('storage', storageEventCallback)

  return () => {
    window.removeEventListener('storage', storageEventCallback)
  }
}

// https://docs.pmnd.rs/zustand/integrations/persisting-store-data#usage-in-next.js
export const usePersistStore = create<PersistedStore>()(
  persist(
    (...store) => ({
      ...createSystemSlice(...store),
      ...createNoteSlice(...store),
    }),
    {
      name: process.env.SERVICE_NAME ?? 'etoN-app',
      partialize: ({theme}) => ({theme}),
      skipHydration: true,
      onRehydrateStorage:
        ({setHasHydrated}) =>
        () => {
          setHasHydrated(true)
        },
    },
  ),
)
