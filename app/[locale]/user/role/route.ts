import {getServerSession} from 'next-auth'
import {NextResponse} from 'next/server'
import {authOptions} from '~/config/auth'
import {getUserRole} from '~/db/helper/users'
import type {ServerError} from '~/types'

export async function GET() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email

  if (!email) {
    return NextResponse.json({error: 'Email is required'}, {status: 400})
  }

  try {
    const role = await getUserRole(email)
    return NextResponse.json(role, {status: 200})
  } catch (error) {
    const serverErr = error as ServerError
    return NextResponse.json({error: serverErr.message}, {status: 500})
  }
}
