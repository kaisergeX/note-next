import {neon} from '@neondatabase/serverless'
import {drizzle} from 'drizzle-orm/neon-http'

let dbInstance: ReturnType<typeof drizzle> | null = null

function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set')
  }
  const sql = neon(process.env.DATABASE_URL)
  dbInstance = drizzle({client: sql})
  return dbInstance
}

// a getter alias named `db` to minimize boilerplace & changes.
export const db = new Proxy(
  {},
  {
    get(_, prop) {
      return Reflect.get(dbInstance || getDb(), prop)
    },
  },
) as ReturnType<typeof drizzle>

/**
 * Even if Postgres `TEXT` data type can store up to 268.435.456 UTF-8 characters
 * (assuming that each character was encoded by UTF-8 using 4 bytes for the most exotic characters
 * such as East Asian languages, emojis and other symbols).
 *
 * We should limit it on server to reduce performance issues.
 */
export const DB_TEXT_LIMIT = 65535
