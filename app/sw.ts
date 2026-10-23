import {defaultCache} from '@serwist/next/worker'
import type {PrecacheEntry, SerwistGlobalConfig} from 'serwist'
import {NetworkOnly, Serwist} from 'serwist'
import {isNoteNetworkPath, isPrecacheablePath} from '~/lib/notes/network-policy'

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const isAiApiRoute = ({url}: {url: URL}) => url.pathname.startsWith('/api/ai/')
const isAppearanceApiRoute = ({url}: {url: URL}) =>
  url.pathname === '/api/user/appearance'

const isNoteRoute = ({url, sameOrigin}: {url: URL; sameOrigin: boolean}) =>
  sameOrigin && isNoteNetworkPath(url.pathname)
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST?.filter((entry) =>
    isPrecacheablePath(
      new URL(
        typeof entry === 'string' ? entry : entry.url,
        self.location.origin,
      ).pathname,
    ),
  ),
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // First match wins. Protect bodies and mutations before generic runtime rules.
    {matcher: isNoteRoute, handler: new NetworkOnly(), method: 'GET'},
    {matcher: isNoteRoute, handler: new NetworkOnly(), method: 'POST'},
    {matcher: isAiApiRoute, handler: new NetworkOnly(), method: 'GET'},
    {matcher: isAiApiRoute, handler: new NetworkOnly(), method: 'POST'},
    {matcher: isAppearanceApiRoute, handler: new NetworkOnly(), method: 'GET'},
    {matcher: isAppearanceApiRoute, handler: new NetworkOnly(), method: 'PUT'},
    ...defaultCache,
  ],
  disableDevLogs: true,
})

// Remove note responses cached by older workers, without clearing other assets.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        const cache = await caches.open(name)
        for (const request of await cache.keys()) {
          const url = new URL(request.url)
          if (
            url.origin === self.location.origin &&
            isNoteNetworkPath(url.pathname)
          )
            await cache.delete(request)
        }
      }
    })(),
  )
})

serwist.addEventListeners()
