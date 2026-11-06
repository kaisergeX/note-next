import createIntlMiddleware from 'next-intl/middleware'
import {NextResponse, type NextProxy, type ProxyConfig} from 'next/server'
import {protectedApiRegex, protectedPathnameRegex} from './config/auth'
import {localeRouting} from './i18n/routing'

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

function apiMiddleware() {
  // if (await rateLimit(req)) {
  //   return rateLimitErrResponse()
  // }

  return NextResponse.next()
}

const proxy: NextProxy = (req) => {
  const {pathname} = req.nextUrl

  if (pathname === '/sw.js') {
    if (process.env.NODE_ENV !== 'development') return NextResponse.next()

    // Disabling registration does not retire a worker from a local production run.
    // Replace it without cache handlers, storage deletion, or forced page reloads.
    return new NextResponse(
      `self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
    await self.registration.unregister();
  })());
});`,
      {
        headers: {
          'Content-Type': 'text/javascript; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      },
    )
  }

  // const isPublicPage = publicPathnameRegex.test(pathname)
  const isProtectedRoutes = protectedPathnameRegex.test(pathname)
  if (!isProtectedRoutes) {
    return intlMiddleware(req)
  }

  if (protectedApiRegex.test(pathname)) {
    return apiMiddleware()
  }

  return intlMiddleware(req)
}

export const config: ProxyConfig = {
  // Skip all paths that should not be internationalized and authenticated
  matcher: ['/sw.js', '/((?!api/auth/.*|_next|_vercel|.*\\..*).*)'],
}

export default proxy
