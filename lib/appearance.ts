// Preserve the browser store's existing key, independent of server-only branding.
export const APPEARANCE_STORAGE_KEY = 'etoN-app'

export const APPEARANCE_IDS = [
  'paper-ink',
  'sepia',
  'midnight',
  'bookish',
] as const

export type AppearanceId = (typeof APPEARANCE_IDS)[number]
export type AppearanceMode = 'system' | 'light' | 'dark'

export type AppearancePreference = {
  appearance: AppearanceId
  mode: AppearanceMode
}

export function isAppearancePreference(
  value: unknown,
): value is AppearancePreference {
  return (
    !!value &&
    typeof value === 'object' &&
    'appearance' in value &&
    isAppearanceId(value.appearance) &&
    'mode' in value &&
    isAppearanceMode(value.mode)
  )
}

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
      state.appearance === 'sepia' ||
      state.appearance === 'paper-ink' ||
      state.appearance === 'midnight' ||
      state.appearance === 'bookish'
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
  return `(${applyStoredAppearance.toString()})(${JSON.stringify(APPEARANCE_STORAGE_KEY)});(${syncBrowserThemeColor.toString()})()`
}

// Self-contained because this also runs in the pre-paint bootstrap script.
// Convert the CSS palette to sRGB for browsers whose metadata parser does not
// accept modern CSS color syntax. CSS remains the only palette source.
export function syncBrowserThemeColor() {
  const metas = document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  )
  if (!metas.length) return
  const paper = getComputedStyle(document.documentElement)
    .getPropertyValue('--paper')
    .trim()
  if (!paper) return
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d')
  if (!context) return
  context.fillStyle = paper
  context.fillRect(0, 0, 1, 1)
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data
  // React matches hoisted meta tags by their exact content (not their media or
  // data attributes). Use RGB syntax to keep this runtime-owned tag distinct
  // from the hex-valued viewport fallbacks, even when the colors are identical.
  const color = `rgb(${r}, ${g}, ${b})`
  // Leave React's server metadata intact so hydration can match those tags.
  // The first matching theme-color wins: this runtime-owned override precedes
  // the OS-based fallbacks and can be recreated after head reconciliation.
  let meta = document.querySelector<HTMLMetaElement>(
    'meta[data-appearance-theme-color]',
  )
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.dataset.appearanceThemeColor = ''
  }
  if (meta.content !== color) meta.content = color
  if (document.querySelector('meta[name="theme-color"]') !== meta) {
    document.head.prepend(meta)
  }
}
