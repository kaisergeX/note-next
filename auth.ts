import 'server-only'

import NextAuth, {type NextAuthConfig} from 'next-auth'
import GoogleProvider, {type GoogleProfile} from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import {AUTH_ERROR_CODE} from './constants'
import {addUser, getCachedUser} from './db/helper/users'
import {RoleEnum, type NewUser} from './db/schema/users'

const authOptions: NextAuthConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    // DEV-ONLY visual-QA bypass — remove before any production deploy.
    // Gate on NODE_ENV: `pnpm dev` (`next dev`) sets it to 'development';
    // `pnpm build` / `next start` set it to 'production', so this provider
    // is never bundled or registered outside dev. Accepts any email.
    ...(process.env.NODE_ENV === 'development'
      ? [
          Credentials({
            credentials: {
              email: {},
              password: {},
            },
            authorize: async (credentials) => {
              const email =
                typeof credentials?.email === 'string'
                  ? credentials.email
                  : undefined
              if (!email) return null

              // Mirror the Google signIn flow: upsert the user so the
              // jwt callback's getCachedUser lookup succeeds.
              const added = await addUser({
                name: email.split('@')[0] || email,
                email,
              })
              if (!added) return null

              return {
                id: email,
                email,
                name: email.split('@')[0] || email,
                role: RoleEnum['note-taker'],
              }
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    jwt: async ({token, user}) => {
      // @todo force update token when role changes

      if (user?.email) token.email = user.email

      if (token.email) {
        try {
          const userInfo = await getCachedUser(token.email)
          if (!userInfo) {
            token.error = AUTH_ERROR_CODE.USER_NOT_FOUND
            console.error(
              `[auth callbacks] User with email ${token.email} not found`,
            )
            return token
          }

          if (!userInfo.role) {
            console.error(`[auth callbacks] User ${token.email} role not found`)
          }

          token.role = userInfo.role || RoleEnum['note-taker']
        } catch (error) {
          console.log('[auth callbacks]', error)
          token.role = RoleEnum['note-taker']
        }
      }

      return token
    },
    session: ({session, token}) => {
      if (token.error) {
        session.error = token.error
        return session
      }

      if (!token.email) {
        session.error = AUTH_ERROR_CODE.EMAIL_NOT_FOUND
        return session
      }

      if (session.user) {
        session.user.role = token.role
        session.user.email = token.email
      }

      return session
    },
    signIn: async ({account, profile}) => {
      // DEV-ONLY visual-QA bypass — remove before any production deploy
      if (account?.provider === 'credentials') return true

      if (!profile) {
        throw new Error(AUTH_ERROR_CODE.NO_PROFILE)
      }

      if (!profile.email_verified) {
        throw new Error(AUTH_ERROR_CODE.EMAIL_NOT_VERIFIED)
      }

      if (!profile.email) {
        return false
      }

      if (account?.provider === 'google') {
        const googleProfile = profile as GoogleProfile
        const newUsers: NewUser = {
          name: googleProfile.name,
          email: googleProfile.email,
          image: googleProfile.picture,
        }

        return await addUser(newUsers)
      }
      return true
    },
    authorized: ({auth}) => !!auth?.user?.email && !auth.error,
  },
  pages: {
    signIn: '/login',
    error: '/denied/permission',
  },
}

export const {auth, handlers} = NextAuth(authOptions)
