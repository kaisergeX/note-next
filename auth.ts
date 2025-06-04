import NextAuth, {type NextAuthConfig} from 'next-auth'
import GoogleProvider, {type GoogleProfile} from 'next-auth/providers/google'
import {db} from './db'
import {getCachedUserRole} from './db/helper/users'
import {RoleEnum, usersTable, type NewUser} from './db/schema/users'

const authOptions: NextAuthConfig = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    jwt: async ({token, user}) => {
      // @todo force update token when role changes

      if (user?.email) token.email = user.email

      if (token.email) {
        try {
          const userRole = await getCachedUserRole(token.email)
          token.role = userRole
        } catch (error) {
          console.log(error)
          token.role = RoleEnum['note-taker']
        }
      }

      return token
    },
    session: ({session, token}) => {
      if (!token.email) throw new Error('Email is required')

      if (session.user) {
        session.user.role = token.role
        session.user.email = token.email
      }

      return session
    },
    signIn: async ({account, profile}) => {
      if (!profile) {
        throw new Error('No profile')
      }

      if (!profile.email_verified) {
        throw new Error('Email is not verified')
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

        await db.insert(usersTable).values(newUsers).onConflictDoNothing()
      }
      return true
    },
    authorized: ({auth}) => !!auth?.user?.email,
  },
  pages: {
    signIn: '/login',
  },
}

export const {auth, handlers, signIn, signOut} = NextAuth(authOptions)
