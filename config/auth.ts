import NextAuth, {type NextAuthConfig} from 'next-auth'
import GoogleProvider, {type GoogleProfile} from 'next-auth/providers/google'
import {db} from '~/db'
import {getUserRole} from '~/db/helper/users'
import {RoleEnum, UsersTable, type NewUser} from '~/db/schema/users'
import {localeRouting} from './localization'

export const authOptions: NextAuthConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    jwt: async ({token}) => {
      // @todo force update token when role changes
      if (token.email) {
        try {
          const userRole = await getUserRole(token.email)
          token.role = userRole
        } catch (error) {
          console.log(error)
          token.role = RoleEnum['note-taker']
        }
      }

      return token
    },
    session: ({session, token}) => {
      if (session.user) {
        session.user.role = token.role
      }

      return session
    },
    signIn: async ({account, profile}) => {
      if (!profile) {
        throw new Error('No profile')
      }

      if (account?.provider === 'google') {
        const googleProfile = profile as GoogleProfile
        const newUsers: NewUser = {
          name: googleProfile.name,
          email: googleProfile.email,
          image: googleProfile.picture,
        }

        await db.insert(UsersTable).values(newUsers).onConflictDoNothing()
      }
      return true
    },
    authorized: ({auth}) => !!auth?.user?.email,
  },
  pages: {
    signIn: '/login',
  },
}

// @todo need to add not-found and error pages here, still couldn't find a way to do it
// temporarily use logic opposite to it with protectedRoutes instead
// const publicPages = ['/', '/login', '/trust(.*)']
// const publicPathnameRegex = pathNameRegex(publicPages)

// /eton(/(.*))*
// OK: /eton, /eton/, /eton/abc, /eton/abc/def...
// NG: /etonabc, /etonabc/def
const archivistRoutes = ['/admin(/(.*))*']

// /^\/api(?!\/auth\/.*)(\/(.*))*$/
// OK: /api, /api/auth, /api/authenblabla, /api/abc, /api/abc/def...
// NG: /api/auth/, /api/auth/session...
const protectedAPIRoutes = ['/api(?!/auth/.*)(/(.*))*']

const protectedRoutes = [
  ...archivistRoutes,
  ...protectedAPIRoutes,
  '/eton(/(.*))*',
  '/user(/(.*))*',
]

/**
 * @example
 * const protectedRoutes = ['/routea(/(.*))*', '/routeb(/(.*))*']
 * pathNameRegex(protectedRoutes) => /^(\/(en|vi))?(\/routea(\/(.*))*|\/routeb(\/(.*))*)+\/?$/i
 */
const pathNameRegex = (routes: string[]) =>
  new RegExp(
    `^(/(${localeRouting.locales.join('|')}))?(${routes.join('|')})+/?$`,
    'i',
  )

export const protectedPathnameRegex = pathNameRegex(protectedRoutes)
export const archivistPathnameRegex = pathNameRegex(archivistRoutes)
export const protectedApiRegex = pathNameRegex(protectedAPIRoutes)
export const {auth, handlers, signIn, signOut} = NextAuth(authOptions)
