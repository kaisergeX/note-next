import {sql} from '@vercel/postgres'
import {drizzle} from 'drizzle-orm/vercel-postgres'

export const db = drizzle(sql)

/**
 * Even if Postgres `TEXT` data type can store up to 268.435.456 UTF-8 characters
 * (assuming that each character was encoded by UTF-8 using 4 bytes for the most exotic characters
 * such as East Asian languages, emojis and other symbols).
 *
 * We should limit it on server to reduce performance issues.
 */
export const DB_TEXT_LIMIT = 65535
