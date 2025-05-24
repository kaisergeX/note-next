import {NextResponse} from 'next/server'
import {getUser} from '~/db/helper/users'
import {defineAuthRoute} from '~/util'

// export const config = {
//   runtime: 'edge'
// };

// We need to manually opt-in rate limit the APIs that are outside of `/api` (see commented code below).

export const GET = defineAuthRoute(async ({session}) => {
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

  const email = session.user.email
  const userInfo = await getUser(email)
  return NextResponse.json(userInfo, {status: 200})
})
