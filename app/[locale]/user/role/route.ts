import {NextResponse} from 'next/server'
import {getUserRole} from '~/db/helper/users'
import {defineAuthRoute} from '~/util'

export const GET = defineAuthRoute(async ({session}) => {
  const email = session.user.email
  const role = await getUserRole(email)
  return NextResponse.json(role, {status: 200})
})
