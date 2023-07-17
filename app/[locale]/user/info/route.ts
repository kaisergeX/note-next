import {getServerSession} from 'next-auth'
import {NextResponse} from 'next/server'
import {authOptions} from '~/config/auth'
import {getUser} from '~/db/helper/users'
import type {ServerError} from '~/types'

// Note:
// This API route is protected by middleware
// All APIs inside /api folder are public

export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email

  if (!email) {
    return NextResponse.json({error: 'Email is required'}, {status: 400})
  }

  try {
    const userInfo = await getUser(email)
    return NextResponse.json(userInfo, {status: 200})
  } catch (error) {
    const serverErr = error as ServerError
    return NextResponse.json({error: serverErr.message}, {status: 500})
  }
}
