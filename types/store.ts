import type {NoteStore} from './note'

export type SystemState = {
  hasHydrated: boolean
  theme?: 'light' | 'dark'
}

export type SystemStore = {
  setHasHydrated: (hasHydrated: SystemState['hasHydrated']) => void
  setTheme: (theme: Exclude<SystemState['theme'], undefined>) => void
  resetSystemStore: () => void
} & SystemState

export type PersistedStore = SystemStore & NoteStore
