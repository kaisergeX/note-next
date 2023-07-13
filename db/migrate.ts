import {createPool} from '@vercel/postgres'
import {drizzle} from 'drizzle-orm/vercel-postgres'
import {migrate} from 'drizzle-orm/vercel-postgres/migrator'
import {
  ULIDGenerateFunction,
  UpdatedAtTriggerFunction,
  NotesTableTrigger,
  UsersTableTrigger,
} from './utils'

async function migrateToLatest() {
  const pool = createPool({
    connectionString: process.env.POSTGRES_URL,
  })
  console.log('Connected to Postgres\n')
  const db = drizzle(pool)

  try {
    console.log('🔧 DB_FUNCTION: Create generate_ulid() function')
    await ULIDGenerateFunction

    console.log('⚡ DB_TRIGGER: Create trigger for updated_at column')
    await UpdatedAtTriggerFunction

    console.log('✨ DB_TABLE: Add trigger to tables')
    await UsersTableTrigger
    await NotesTableTrigger

    console.log('\nMigrating...\n')
    await migrate(db, {migrationsFolder: './drizzle'})
    console.log('✅ Migration was executed successfully!')
  } catch (error) {
    console.error('Migration failed! ', error)
    process.exit(1)
  }

  process.exit(0)
}

void migrateToLatest()
