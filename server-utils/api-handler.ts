import 'server-only'

import type {ObjectAny} from '@kaiverse/k/types'
import type {Session} from 'next-auth'
import {type NextRequest, NextResponse} from 'next/server'
import type {ServerError} from '~/types'
import {auth} from '../auth'

export class ApiAuthError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'ApiAuthError'
  }
}

type NextApiHandlerContext<TParams = Promise<Record<string, string>>> = {
  params: TParams
}

type ApiHandlerContext<TParams = Promise<Record<string, string>>> =
  NextApiHandlerContext<TParams> & {
    request: NextRequest
  }

export function defineApiRoute<
  TParams extends Promise<ObjectAny> = Promise<Record<string, string>>,
>(handler: (ctx: ApiHandlerContext<TParams>) => Promise<Response>) {
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

type AuthHandlerContext<TParams = Promise<Record<string, string>>> =
  ApiHandlerContext<TParams> & {session: Session}

export function defineAuthRoute<
  TParams extends Promise<ObjectAny> = Promise<Record<string, string>>,
>(handler: (params: AuthHandlerContext<TParams>) => Promise<Response>) {
  return defineApiRoute<TParams>(async (ctx) => {
    const session = await auth()
    if (!session) {
      return NextResponse.json({error: 'Unauthorized'}, {status: 401})
    }

    if (session.error) {
      return NextResponse.json({error: session.error}, {status: 403})
    }

    return handler({...ctx, session})
  })
}
