import {createPool} from '@vercel/postgres'
import {drizzle} from 'drizzle-orm/vercel-postgres'
import {migrate} from 'drizzle-orm/vercel-postgres/migrator'

async function migrateToLatest() {
  const pool = createPool({
    connectionString: process.env.POSTGRES_URL,
  })
  console.log('Connected to Postgres')
  const db = drizzle(pool)
  console.log('Migrating...')

  try {
    await migrate(db, {migrationsFolder: './drizzle'})
    console.log('Migration was executed successfully')
    process.exit(0)
  } catch (error) {
    console.error('Migration failed', error)
    process.exit(1)
  }
}

void migrateToLatest()
