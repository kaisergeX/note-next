import 'server-only'

import NextAuth, {type NextAuthConfig} from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import GoogleProvider, {type GoogleProfile} from 'next-auth/providers/google'
import {AUTH_ERROR_CODE} from './constants'
import {cookies} from 'next/headers'
import {addUser, getUser, getUserById} from './db/helper/users'
import {type NewUser} from './db/schema/users'
import {matchesSessionUser} from './lib/auth/session-identity'
import {DELETE_INTENT_COOKIE, decodeDeleteIntent} from './lib/account/reauth'

const VISUAL_QA_EMAIL = 'qa@test.dev'

const authOptions: NextAuthConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      checks: ['pkce', 'state'],
    }),
    // DEV-ONLY visual-QA bypass — remove before any production deploy.
    // Gate on NODE_ENV: `pnpm dev` (`next dev`) sets it to 'development';
    // `pnpm build` / `next start` set it to 'production', so this provider
    // is never bundled or registered outside dev. Only the existing QA user
    // is accepted; look up instead of upserting so a typo cannot create a
    // stray account.
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
                  ? credentials.email.trim().toLowerCase()
                  : undefined
              if (!email || email !== VISUAL_QA_EMAIL) return null

              const userInfo = await getUser(email)
              if (!userInfo) return null

              return {
                id: userInfo.id,
                email,
                name: userInfo.name,
                role: userInfo.role,
              }
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    jwt: async ({token, user, account}) => {
      try {
        if (user?.email) {
          const userInfo = await getUser(user.email)
          if (!userInfo) return null
          token.userId = userInfo.id
          token.email = userInfo.email
          delete token.accountDeleteVerifiedAt
          delete token.error
          if (account?.provider === 'google') {
            const cookieStore = await cookies()
            const raw = cookieStore.get(DELETE_INTENT_COOKIE)?.value
            if (raw) {
              const intent = await decodeDeleteIntent(raw)
              cookieStore.delete(DELETE_INTENT_COOKIE)
              if (
                !intent ||
                intent.userId !== userInfo.id ||
                intent.email !== userInfo.email
              )
                return null
              token.accountDeleteVerifiedAt = Date.now()
            }
          }
        }
        // Do not recover a legacy token by email. Deleted IDs never become valid again.
        if (!token.userId) return null
        const userInfo = await getUserById(token.userId)
        if (!matchesSessionUser(token.userId, userInfo)) return null
        token.role = userInfo!.role
        return token
      } catch {
        console.error('Session identity verification failed')
        return null
      }
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
        session.user.id = token.userId!
        session.user.role = token.role
        session.user.email = token.email
      }

      session.accountDeleteVerifiedAt = token.accountDeleteVerifiedAt

      return session
    },
    signIn: async ({account, profile, user}) => {
      // DEV-ONLY visual-QA bypass
      if (
        process.env.NODE_ENV === 'development' &&
        account?.provider === 'credentials' &&
        user.email === VISUAL_QA_EMAIL
      ) {
        return true
      }

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
        const raw = (await cookies()).get(DELETE_INTENT_COOKIE)?.value
        if (raw) {
          const intent = await decodeDeleteIntent(raw)
          const userInfo = intent ? await getUserById(intent.userId) : null
          if (
            !intent ||
            !userInfo ||
            googleProfile.email !== intent.email ||
            userInfo.email !== intent.email
          ) {
            ;(await cookies()).delete(DELETE_INTENT_COOKIE)
            return `/${intent?.locale ?? 'en'}/settings/account?deleteVerification=failed`
          }
          // Reverification must never create or switch accounts.
          return true
        }
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

export const {auth, handlers, signIn, signOut} = NextAuth(authOptions)
