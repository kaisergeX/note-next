// Limit to 5 requests from the same IP in 10 seconds
export const API_RATE_LIMIT: number = 5
export const API_RATE_LIMIT_DURATION = '10 s'
export const rateLimitCache = new Map()