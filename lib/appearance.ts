// Preserve the browser store's existing key, independent of server-only branding.
export const APPEARANCE_STORAGE_KEY = 'etoN-app'

export const APPEARANCE_IDS = ['paper-ink', 'sepia'] as const

export type AppearanceId = (typeof APPEARANCE_IDS)[number]
export type AppearanceMode = 'system' | 'light' | 'dark'

export function isAppearanceId(value: unknown): value is AppearanceId {
  return APPEARANCE_IDS.some((id) => id === value)
}

export function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

// Keep this function self-contained: its source also runs before hydration.
export function applyStoredAppearance(storageKey: string) {
  const root = document.documentElement
  try {
    const raw = localStorage.getItem(storageKey)
    const saved = raw ? JSON.parse(raw) : null
    const state = saved?.state || {}
    const appearance =
      state.appearance === 'sepia' || state.appearance === 'paper-ink'
        ? state.appearance
        : 'paper-ink'
    let mode = state.mode
    if (mode !== 'system' && mode !== 'light' && mode !== 'dark') {
      mode =
        state.theme === 'light' || state.theme === 'dark'
          ? state.theme
          : 'system'
    }
    root.dataset.appearance = appearance
    root.classList.toggle(
      'dark',
      mode === 'dark' ||
        (mode === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches),
    )
  } catch {
    root.dataset.appearance = 'paper-ink'
    root.classList.toggle(
      'dark',
      window.matchMedia('(prefers-color-scheme: dark)').matches,
    )
  }
}

export function createAppearanceBootstrapScript() {
  return `(${applyStoredAppearance.toString()})(${JSON.stringify(APPEARANCE_STORAGE_KEY)})`
}
