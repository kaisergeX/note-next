import createIntlMiddleware from 'next-intl/middleware'
import {NextResponse, type NextRequest} from 'next/server'
import {localeConfig} from '~/config/localization'
import {withAuth, type NextRequestWithAuth} from 'next-auth/middleware'
import type {NextMiddlewareResult} from 'next/dist/server/web/types'
import {
  archivistPathnameRegex,
  protectedApiRegex,
  protectedPathnameRegex,
} from './config/auth'
import {RoleEnum} from './db/schema/users'
import rateLimit from './db/helper/rateLimit'
import {rateLimitErrResponse} from './config/exceptions'

const redirectToPermissionsDenied = (req: NextRequestWithAuth | NextRequest) =>
  NextResponse.redirect(new URL('/denied/permission', req.url))

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

const apiMiddleware = async (req: NextRequest) => {
  if (await rateLimit(req)) {
    return rateLimitErrResponse()
  }

  // @todo check if there is a proper way to verify permission here
  // instead of calling authMiddleware(req)
  const authenticatedRes = await authMiddleware(req)
  if (!authenticatedRes?.ok) {
    return redirectToPermissionsDenied(req)
  }

  return NextResponse.next()
}

export default async function middleware(req: NextRequest) {
  // const isPublicPage = publicPathnameRegex.test(req.nextUrl.pathname)
  const isProtectedRoutes = protectedPathnameRegex.test(req.nextUrl.pathname)
  if (!isProtectedRoutes) {
    return intlMiddleware(req)
  }

  if (protectedApiRegex.test(req.nextUrl.pathname)) {
    // Middleware for all API routes except /api/auth/* route.
    // Need authenticated to request.
    return apiMiddleware(req)
  }

  return authMiddleware(req)
}

export const config = {
  // Skip all paths that should not be internationalized and authenticated
  matcher: ['/((?!api/auth/.*|_next|.*\\..*).*)'],
}
