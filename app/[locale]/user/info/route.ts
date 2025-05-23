import {NextResponse} from 'next/server'
import {auth} from '~/config/auth'
import {getUser} from '~/db/helper/users'
import type {ServerError} from '~/types'

// export const config = {
//   runtime: 'edge'
// };

// Note:
// This API route is protected by auth middleware
// Same as all APIs inside /api folder (except /api/auth/*)
//
// The diff is we need to manually opt-in rate limit the APIs that are outside of `/api` (see commented code below).

export async function GET() {
  /**
   * ⚠️ Avoid it if possible, because its not cached and makes a remote call to Redis with each request.
   * Waste money and slow down the response time.
   * if you really need to rate limit the API route, move it inside `api` folder
   * or manually add ur routes to `protectedAPIRoutes` arr then middleware will handle the rest for you.
   */
  // const isRateLimit = await rateLimit(request)
  // if (isRateLimit) {
  //   return rateLimitErrResponse()
  // }

  const session = await auth()
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
