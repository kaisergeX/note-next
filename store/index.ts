import {create} from 'zustand'
import {persist} from 'zustand/middleware'
import {isAppearanceId, isAppearanceMode} from '~/lib/appearance'
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
      version: 1,
      partialize: ({mode, appearance}) => ({mode, appearance}),
      migrate: (persistedState) => {
        const state = persistedState as
          {theme?: unknown; mode?: unknown; appearance?: unknown} | undefined
        const legacyMode =
          state?.theme === 'light' || state?.theme === 'dark'
            ? state.theme
            : 'system'

        return {
          mode: isAppearanceMode(state?.mode) ? state.mode : legacyMode,
          appearance: isAppearanceId(state?.appearance)
            ? state.appearance
            : 'paper-ink',
        }
      },
      merge: (persistedState, currentState) => {
        const state = persistedState as
          {mode?: unknown; appearance?: unknown} | undefined

        return {
          ...currentState,
          mode: isAppearanceMode(state?.mode) ? state.mode : 'system',
          appearance: isAppearanceId(state?.appearance)
            ? state.appearance
            : 'paper-ink',
        }
      },
      skipHydration: true,
      onRehydrateStorage:
        ({setHasHydrated}) =>
        () => {
          setHasHydrated(true)
        },
    },
  ),
)
