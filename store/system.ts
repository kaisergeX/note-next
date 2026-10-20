import type {StateCreator} from 'zustand'
import type {SystemState, SystemStore} from '~/types/store'

export const initSystemState: SystemState = {
  hasHydrated: false,
  mode: 'system',
  appearance: 'paper-ink',
}

export const createSystemSlice: StateCreator<SystemStore> = (set) => ({
  ...initSystemState,
  setHasHydrated: (hasHydrated) => set(() => ({hasHydrated})),
  setMode: (mode) => set(() => ({mode})),
  setAppearance: (appearance) => set(() => ({appearance})),
  resetSystemStore: () => set(() => ({...initSystemState})),
})
