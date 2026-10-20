export const APPEARANCE_IDS = ['paper-ink', 'sepia'] as const

export type AppearanceId = (typeof APPEARANCE_IDS)[number]
export type AppearanceMode = 'system' | 'light' | 'dark'

export function isAppearanceId(value: unknown): value is AppearanceId {
  return APPEARANCE_IDS.some((id) => id === value)
}

export function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function createAppearanceBootstrapScript(storageKey: string) {
  return `(function(){var root=document.documentElement;try{var raw=localStorage.getItem(${JSON.stringify(storageKey)});var saved=raw?JSON.parse(raw):null;var state=saved&&saved.state||{};var appearance=state.appearance==='sepia'||state.appearance==='paper-ink'?state.appearance:'paper-ink';var mode=state.mode;if(mode!=='system'&&mode!=='light'&&mode!=='dark'){mode=state.theme==='light'||state.theme==='dark'?state.theme:'system'}root.dataset.appearance=appearance;root.classList.toggle('dark',mode==='dark'||(mode==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches))}catch(e){root.dataset.appearance='paper-ink';root.classList.toggle('dark',window.matchMedia('(prefers-color-scheme: dark)').matches)}})()`
}
