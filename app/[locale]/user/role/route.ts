import {NextResponse} from 'next/server'
import {getUserRole} from '~/db/helper/users'
import type {ServerError} from '~/types'

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url)
  const email = searchParams.get('email')
  console.log('user/role', email)

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
