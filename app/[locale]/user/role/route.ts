import {NextResponse} from 'next/server'
import {getCachedUserRole} from '~/db/helper/users'
import {defineAuthRoute} from '~/util'

export const GET = defineAuthRoute(async ({session}) => {
  const email = session.user.email
  const role = await getCachedUserRole(email)
  return NextResponse.json(role, {status: 200})
})
