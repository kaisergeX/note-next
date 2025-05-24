import createIntlMiddleware from 'next-intl/middleware'
import {
  NextResponse,
  type MiddlewareConfig,
  type NextMiddleware,
  type NextRequest,
} from 'next/server'
import {localeRouting} from '~/config/localization'
import {protectedApiRegex, protectedPathnameRegex} from './config/auth'

// import {rateLimitErrResponse} from './config/exceptions'
// import rateLimit from './db/helper/rateLimit'

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

async function apiMiddleware(req: NextRequest) {
  // if (await rateLimit(req)) {
  //   return rateLimitErrResponse()
  // }

  return NextResponse.next()
}

const middleware: NextMiddleware = async (req, e) => {
  const {pathname} = req.nextUrl

  // const isPublicPage = publicPathnameRegex.test(pathname)
  const isProtectedRoutes = protectedPathnameRegex.test(pathname)
  if (!isProtectedRoutes) {
    return intlMiddleware(req)
  }

  if (protectedApiRegex.test(pathname)) {
    return apiMiddleware(req)
  }

  return intlMiddleware(req)
}

export const config: MiddlewareConfig = {
  // Skip all paths that should not be internationalized and authenticated
  matcher: ['/((?!api/auth/.*|_next|.*\\..*).*)'],
}

export default middleware
