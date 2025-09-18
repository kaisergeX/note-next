import type {DefaultSession, User as DefaultUser} from 'next-auth'
import type {DefaultJWT} from 'next-auth/jwt'
import type {Role} from '~/db/schema/users'
import type {AuthServerError} from '.'

declare module 'next-auth' {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session extends Omit<DefaultSession, 'user'> {
    user: User
    error?: AuthServerError
  }

  /**
   * The shape of the user object returned in the OAuth providers' `profile` callback,
   * or the second parameter of the `session` callback, when using a database.
   */
  interface User extends Omit<DefaultUser, 'email'> {
    email: string
    role: Role
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    role: Role
    error?: AuthServerError
  }
}
