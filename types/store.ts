import type {NoteStore} from './note'
import type {AppearanceId, AppearanceMode} from '~/lib/appearance'
import type {AppearanceSyncStatus} from '~/lib/appearance-sync'

export type SystemState = {
  hasHydrated: boolean
  mode: AppearanceMode
  appearance: AppearanceId
  appearanceSyncStatus: AppearanceSyncStatus
  appearanceSaveNotice: boolean
  appearanceChangeId: number
}

export type SystemStore = {
  setHasHydrated: (hasHydrated: SystemState['hasHydrated']) => void
  setMode: (mode: AppearanceMode) => void
  setAppearance: (appearance: AppearanceId) => void
  resetSystemStore: () => void
} & SystemState

export type PersistedStore = SystemStore & NoteStore
