import createIntlMiddleware from 'next-intl/middleware'
import {NextResponse, type NextRequest} from 'next/server'
import {localeConfig} from '~/config/localization'
import {withAuth, type NextRequestWithAuth} from 'next-auth/middleware'
import type {NextMiddlewareResult} from 'next/dist/server/web/types'
import {archivistPathnameRegex, protectedPathnameRegex} from './config/auth'
import {RoleEnum} from './db/schema/users'

const redirectToPermissionsDenied = (req: NextRequestWithAuth) =>
  NextResponse.redirect(new URL('/denied', req.url))

const intlMiddleware = createIntlMiddleware(localeConfig)
const authMiddleware = withAuth(
  // Note that this callback is only invoked if
  // the `authorized` callback has returned `true`
  // and not for pages listed in `pages`.
  function middleware(req) {
    const userRole = req.nextauth.token?.role
    if (
      userRole !== RoleEnum.archivist &&
      archivistPathnameRegex.test(req.nextUrl.pathname)
    ) {
      return redirectToPermissionsDenied(req)
    }

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
