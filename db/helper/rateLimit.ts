import {type NextRequest} from 'next/server'
import {ipAddress} from '@vercel/functions'
import {Ratelimit} from '@upstash/ratelimit'
// import {kv} from '@vercel/kv'
import {API_RATE_LIMIT, API_RATE_LIMIT_DURATION} from '~/config/system'

// const ratelimit = new Ratelimit({
//   redis: kv,
//   limiter: Ratelimit.slidingWindow(API_RATE_LIMIT, API_RATE_LIMIT_DURATION),
// })

// // export const config = {
// //   runtime: 'edge',
// // }

// /**
//  * Rate limit the requests from the same IP.
//  * ___
//  * ⚠️ Not recommended to use outside of `middleware`.
//  * ___
//  * @returns `true` if the request's rate limit exceeded.
//  */
// export default async function rateLimit(request: NextRequest) {
//   const ip = ipAddress(request) ?? '127.0.0.1'
//   const {limit, reset, remaining, success} = await ratelimit.limit(ip)

//   request.headers.set('X-RateLimit-Limit', limit.toString())
//   request.headers.set('X-RateLimit-Remaining', remaining.toString())
//   request.headers.set('X-RateLimit-Reset', reset.toString())

//   return !success
// }
