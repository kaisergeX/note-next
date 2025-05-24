import {Pool} from '@neondatabase/serverless'
import {drizzle} from 'drizzle-orm/neon-http'
import {migrate} from 'drizzle-orm/vercel-postgres/migrator'
import {
  ULIDGenerateFunction,
  UpdatedAtFunction,
  AddUpdatedAtTrigger,
} from './utils'

// async function migrateToLatest() {
//   const pool = new Pool({
//     connectionString: process.env.DATABASE_URL,
//   })
//   console.log('Connected to Postgres\n')
//   const db = drizzle(pool)

//   try {
//     console.log('🔧 DB_FUNCTION: Create generate_ulid() function')
//     await ULIDGenerateFunction

//     console.log('🔧 DB_FUNCTION: Create auto-update updated_at column function')
//     await UpdatedAtFunction

//     console.log('⚡ DB_TABLE: Add trigger to tables')
//     await AddUpdatedAtTrigger

//     console.log('\nMigrating...\n')
//     await migrate(db, {migrationsFolder: './drizzle'})
//     console.log('✅ Migration was executed successfully!')
//   } catch (error) {
//     console.error('___\nMigration failed! ', error)
//     process.exit(1)
//   } finally {
//     await pool.end()
//   }

//   process.exit(0)
// }

// void migrateToLatest()
