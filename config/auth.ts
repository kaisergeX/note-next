import type {NextAuthOptions} from 'next-auth'
import GoogleProvider, {type GoogleProfile} from 'next-auth/providers/google'
import {localeConfig} from './localization'
import {db} from '~/db'
import {UsersTable} from '~/db/schema/users'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    signIn: async ({account, profile}) => {
      if (!profile) {
        throw new Error('No profile')
      }

      if (account?.provider === 'google') {
        const googleProfile = profile as GoogleProfile
        const newUsers = {
          name: googleProfile.name ?? '',
          email: googleProfile.email ?? '',
          image: googleProfile.picture ?? '',
        }

        await db.insert(UsersTable).values(newUsers).onConflictDoNothing()
      }
      return true
    },
  },
}

// @todo need to add not-found and error pages here, still couldn't find a way to do it
// temporarily use logic opposite to it with protectedRoutes instead
// const publicPages = ['/', '/login', '/trust(.*)', '/api(.*)']

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
