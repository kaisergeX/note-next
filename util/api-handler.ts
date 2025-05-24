import type {Session} from 'next-auth'
import {redirect} from 'next/navigation'
import {type NextRequest, NextResponse} from 'next/server'
import type {ServerError} from '~/types'
import {auth} from '../auth'

export class ApiAuthError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'ApiAuthError'
  }
}

/**
 * This is `next-auth`'s {@link auth} function with auto-redirect if not authenticated.
 * As a result, the returned `session` is non-nullable.
 *
 * @param redirectUrl redirect url for unauthenticated users
 * @default '/login'
 */
export async function requireAuth(redirectUrl = '/login') {
  const session = await auth()
  if (!session) redirect(redirectUrl)
  return session
}

type NextApiHandlerContext<TParams = Record<string, string>> = {
  params: TParams
}

type ApiHandlerContext<TParams = Record<string, string>> =
  NextApiHandlerContext<TParams> & {
    request: NextRequest
  }

export function defineApiRoute<TParams = Record<string, string>>(
  handler: (ctx: ApiHandlerContext<TParams>) => Promise<Response>,
) {
  return async (
    request: NextRequest,
    context: NextApiHandlerContext<TParams>,
  ) => {
    try {
      return await handler({request, ...context})
    } catch (err) {
      if (err instanceof ApiAuthError) {
        return NextResponse.json({error: err.message}, {status: 401})
      }

      const serverErr = err as ServerError
      return NextResponse.json(
        {error: serverErr.message || 'Internal server error'},
        {status: 500},
      )
    }
  }
}

type AuthHandlerContext<TParams = Record<string, string>> =
  ApiHandlerContext<TParams> & {session: Session}

export function defineAuthRoute<TParams = Record<string, string>>(
  handler: (params: AuthHandlerContext<TParams>) => Promise<Response>,
) {
  return defineApiRoute<TParams>(async (ctx) => {
    const session = await auth()
    if (!session) {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    }

    return handler({...ctx, session})
  })
}
