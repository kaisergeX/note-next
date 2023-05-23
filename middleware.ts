import createMiddleware from 'next-intl/middleware'
import {localeConfig} from '~/config/localization'

export default createMiddleware(localeConfig)

export const config = {
  // Skip all paths that should not be internationalized
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
