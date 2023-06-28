import createIntlMiddleware from 'next-intl/middleware'
import type {NextRequest} from 'next/server'
import {localeConfig} from '~/config/localization'
import {withAuth} from 'next-auth/middleware'
import type {NextMiddlewareResult} from 'next/dist/server/web/types'

const intlMiddleware = createIntlMiddleware(localeConfig)

const publicPages = ['/', '/login', '/api(.*)']
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
  const publicPathnameRegex = RegExp(
    `^(/(${localeConfig.locales.join('|')}))?(${publicPages.join('|')})?/?$`,
    'i',
  )
  const isPublicPage = publicPathnameRegex.test(req.nextUrl.pathname)

  if (isPublicPage) {
    return intlMiddleware(req)
  }

  return authMiddleware(req)
}

export const config = {
  // Skip all paths that should not be internationalized and authenticated
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
