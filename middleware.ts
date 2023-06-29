import createIntlMiddleware from 'next-intl/middleware'
import type {NextRequest} from 'next/server'
import {localeConfig} from '~/config/localization'
import {withAuth} from 'next-auth/middleware'
import type {NextMiddlewareResult} from 'next/dist/server/web/types'

const intlMiddleware = createIntlMiddleware(localeConfig)

// @todo need to add not-found and error pages here, still couldn't find a way to do it
// temporarily use logic opposite to it with protectedRoutes instead
// const publicPages = ['/', '/login', '/api(.*)']

// /eton(/(.*))*
// OK: /eton, /eton/, /eton/abc, /eton/abc/def...
// NG: /etonabc, /etonabc/def
const protectedRoutes = ['/eton(/(.*))*', '/users(/(.*))*']

const authMiddleware = withAuth(
  // Note that this callback is only invoked if
  // the `authorized` callback has returned `true`
  // and not for pages listed in `pages`.
  function onSuccess(req) {
    return intlMiddleware(req)
  },
  {
    callbacks: {
      authorized: ({token}) => token != null,
    },
    pages: {
      signIn: '/login',
    },
  },
) as (request: NextRequest) => Promise<NextMiddlewareResult>

export default function middleware(req: NextRequest) {
  // const publicPathnameRegex = RegExp(
  //   `^(/(${localeConfig.locales.join('|')}))?(${publicPages.join('|')})?/?$`,
  //   'i',
  // )

  // /^(\/(en|vi))?(\/eton(\/(.*))*|\/users(\/(.*))*)+\/?$/i
  const protectedPathnameRegex = RegExp(
    `^(/(${localeConfig.locales.join('|')}))?(${protectedRoutes.join(
      '|',
    )})+/?$`,
    'i',
  )

  // const isPublicPage = publicPathnameRegex.test(req.nextUrl.pathname)
  const isProtectedRoutes = protectedPathnameRegex.test(req.nextUrl.pathname)
  if (!isProtectedRoutes) {
    return intlMiddleware(req)
  }

  return authMiddleware(req)
}

export const config = {
  // Skip all paths that should not be internationalized and authenticated
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
