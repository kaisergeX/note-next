import type {StateCreator} from 'zustand'
import type {SystemState, SystemStore} from '~/types/store'

export const initSystemState: SystemState = {
  hasHydrated: false,
}

export const createSystemSlice: StateCreator<SystemStore> = (set) => ({
  ...initSystemState,
  setHasHydrated: (hasHydrated) => set(() => ({hasHydrated})),
  setTheme: (theme) => set(() => ({theme})),
  resetSystemStore: () => set(() => ({}), true),
})
