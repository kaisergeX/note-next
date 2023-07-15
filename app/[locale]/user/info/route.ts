import {NextResponse} from 'next/server'
import {getUser} from '~/db/helper/users'
import type {ServerError} from '~/types'

// Note:
// This API route is protected by middleware
// All APIs inside /api folder are public

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({error: 'Email is required'}, {status: 400})
  }

  try {
    const role = await getUser(email)
    return NextResponse.json({role}, {status: 200})
  } catch (error) {
    const serverErr = error as ServerError
    return NextResponse.json({error: serverErr.message}, {status: 500})
  }
}
