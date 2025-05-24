import {localeRouting} from './localization'

// @todo need to add not-found and error pages here, still couldn't find a way to do it
// temporarily use logic opposite to it with protectedRoutes instead
// const publicPages = ['/', '/login', '/trust(.*)']
// const publicPathnameRegex = pathNameRegex(publicPages)

// /eton(/(.*))*
// OK: /eton, /eton/, /eton/abc, /eton/abc/def...
// NG: /etonabc, /etonabc/def
const archivistRoutes = ['/admin(/(.*))*']

// /^\/api(?!\/auth\/.*)(\/(.*))*$/
// OK: /api, /api/auth, /api/authenblabla, /api/abc, /api/abc/def...
// NG: /api/auth/, /api/auth/session...
const protectedAPIRoutes = ['/api(?!/auth/.*)(/(.*))*']

const protectedRoutes = [
  ...archivistRoutes,
  ...protectedAPIRoutes,
  '/eton(/(.*))*',
  '/user(/(.*))*',
]

/**
 * @example
 * const protectedRoutes = ['/routea(/(.*))*', '/routeb(/(.*))*']
 * pathNameRegex(protectedRoutes) => /^(\/(en|vi))?(\/routea(\/(.*))*|\/routeb(\/(.*))*)+\/?$/i
 */
const pathNameRegex = (routes: string[]) =>
  new RegExp(
    `^(/(${localeRouting.locales.join('|')}))?(${routes.join('|')})+/?$`,
    'i',
  )

export const protectedPathnameRegex = pathNameRegex(protectedRoutes)
export const archivistPathnameRegex = pathNameRegex(archivistRoutes)
export const protectedApiRegex = pathNameRegex(protectedAPIRoutes)
