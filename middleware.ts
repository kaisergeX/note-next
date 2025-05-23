import createIntlMiddleware from 'next-intl/middleware'
import {
  NextResponse,
  type MiddlewareConfig,
  type NextMiddleware,
  type NextRequest,
} from 'next/server'
import {localeRouting} from '~/config/localization'
import {
  archivistPathnameRegex,
  auth,
  protectedApiRegex,
  protectedPathnameRegex,
} from './config/auth'
import {rateLimitErrResponse} from './config/exceptions'
import rateLimit from './db/helper/rateLimit'
import {isArchivist} from './util'

const redirectToPermissionsDenied = (req: NextRequest) =>
  NextResponse.redirect(new URL('/denied/permission', req.url))

const intlMiddleware = createIntlMiddleware(localeRouting)

// const authMiddleware = withAuth(
//   // Note that this callback is only invoked if
//   // the `authorized` callback has returned `true`
//   // and not for pages listed in `pages`.
//   function middleware(req) {
//     const userRole = req.nextauth.token?.role
//     if (
//       userRole !== RoleEnum.archivist &&
//       archivistPathnameRegex.test(req.nextUrl.pathname)
//     ) {
//       return redirectToPermissionsDenied(req)
//     }

//     return NextResponse.next()
//   },
//   {
//     callbacks: {
//       authorized: ({token}) => token != null,
//     },
//     pages: {
//       signIn: '/login',
//     },
//   },
// ) as (request: NextRequest) => Promise<NextMiddlewareResult>

const apiMiddleware: NextMiddleware = async (req) => {
  if (await rateLimit(req)) {
    return rateLimitErrResponse()
  }

  return NextResponse.next()
}

const middleware: NextMiddleware = async (req, e) => {
  const {pathname} = req.nextUrl

  // const isPublicPage = publicPathnameRegex.test(pathname)
  const isProtectedRoutes = protectedPathnameRegex.test(pathname)
  if (!isProtectedRoutes) {
    return intlMiddleware(req)
  }

  const session = await auth()
  if (!isArchivist(session) && archivistPathnameRegex.test(pathname)) {
    return redirectToPermissionsDenied(req)
  }

  if (protectedApiRegex.test(pathname)) {
    // Middleware for all API routes except /api/auth/* route.
    // Need authenticated to request.
    if (!session) {
      return redirectToPermissionsDenied(req)
    }

    return apiMiddleware(req, e)
  }

  if (!session) {
    return redirectToPermissionsDenied(req)
  }

  return intlMiddleware(req)
}

export const config: MiddlewareConfig = {
  // Skip all paths that should not be internationalized and authenticated
  matcher: ['/((?!api/auth/.*|_next|.*\\..*).*)'],
}

export default middleware
