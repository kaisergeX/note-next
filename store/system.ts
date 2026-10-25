import type {StateCreator} from 'zustand'
import type {SystemState, SystemStore} from '~/types/store'

export const initSystemState: SystemState = {
  hasHydrated: false,
  mode: 'system',
  appearance: 'paper-ink',
  appearanceSyncStatus: 'local',
  appearanceSaveNotice: false,
  appearanceChangeId: 0,
}

export const createSystemSlice: StateCreator<SystemStore> = (set) => ({
  ...initSystemState,
  setHasHydrated: (hasHydrated) => set(() => ({hasHydrated})),
  setMode: (mode) =>
    set((state) => ({mode, appearanceChangeId: state.appearanceChangeId + 1})),
  setAppearance: (appearance) =>
    set((state) => ({
      appearance,
      appearanceChangeId: state.appearanceChangeId + 1,
    })),
  resetSystemStore: () => set(() => ({...initSystemState})),
})
