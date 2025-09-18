// Limit to 5 requests from the same IP in 10 seconds
export const API_RATE_LIMIT: number = 5
export const API_RATE_LIMIT_DURATION = '10 s'
export const rateLimitCache = new Map()

/**
 * Even if Postgres `TEXT` data type can store up to 268.435.456 UTF-8 characters
 * (assuming that each character was encoded by UTF-8 using 4 bytes for the most exotic characters
 * such as East Asian languages, emojis and other symbols).
 *
 * We should limit it on server to reduce performance issues.
 */
export const DB_TEXT_LIMIT = 65535
