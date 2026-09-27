import {defaultCache} from '@serwist/next/worker'
import type {PrecacheEntry, SerwistGlobalConfig} from 'serwist'
import {NetworkOnly, Serwist} from 'serwist'

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

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  disableDevLogs: true,
})

// AI API routes (live LM Studio streams) must never be cached or served from
// cache — PWA runtime caching and a streaming response don't mix. NetworkOnly
// passes fetches straight through. Each route matches one method, so GET and
// POST are registered separately. /api/auth/* behavior is untouched.
serwist.registerCapture(isAiApiRoute, new NetworkOnly(), 'GET')
serwist.registerCapture(isAiApiRoute, new NetworkOnly(), 'POST')

serwist.addEventListeners()
