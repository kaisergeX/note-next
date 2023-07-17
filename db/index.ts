import {sql} from '@vercel/postgres'
import {drizzle} from 'drizzle-orm/vercel-postgres'

export const db = drizzle(sql)

// even if TEXT data type can store up to 214,748,364 characters (UTF-8 encoding),
// we should limit it on application side.
export const DB_TEXT_LIMIT = 65535
