import type {NextAuthOptions} from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import {localeConfig} from './localization'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
}

// @todo need to add not-found and error pages here, still couldn't find a way to do it
// temporarily use logic opposite to it with protectedRoutes instead
// const publicPages = ['/', '/login', '/api(.*)']

// /eton(/(.*))*
// OK: /eton, /eton/, /eton/abc, /eton/abc/def...
// NG: /etonabc, /etonabc/def
const protectedRoutes = ['/eton(/(.*))*', '/users(/(.*))*']
// const publicPathnameRegex = RegExp(
//   `^(/(${localeConfig.locales.join('|')}))?(${publicPages.join('|')})?/?$`,
//   'i',
// )

// /^(\/(en|vi))?(\/eton(\/(.*))*|\/users(\/(.*))*)+\/?$/i
export const protectedPathnameRegex = RegExp(
  `^(/(${localeConfig.locales.join('|')}))?(${protectedRoutes.join('|')})+/?$`,
  'i',
)
