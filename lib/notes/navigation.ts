export const BROWSER_WORK_PATH = '/collection/browser-work'

export function noteReturnPath(source: string | null) {
  return source === 'browser-work' ? BROWSER_WORK_PATH : '/eton'
}

export function withBrowserWorkReturn(href: string, fromBrowserWork: boolean) {
  return fromBrowserWork
    ? `${href}${href.includes('?') ? '&' : '?'}from=browser-work`
    : href
}
