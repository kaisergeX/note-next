import {NextResponse} from 'next/server'
import type {ServerError} from '~/types'

export function rateLimitErrResponse() {
  return NextResponse.json<ServerError>(
    {
      name: 'Rate limit exceeded',
      message: 'Requests rate limit exceeded',
      digest: 429,
    },
    {status: 429},
  )
}
