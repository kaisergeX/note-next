import * as path from 'path'
import {promises as fs} from 'fs'
import {Migrator, FileMigrationProvider, Kysely, PostgresDialect} from 'kysely'
import {type Database} from './kysely'
import {createPool} from '@vercel/postgres'

async function migrateToLatest() {
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: createPool({
        connectionString: process.env.POSTGRES_URL,
      }),
    }),
  })

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      // This needs to be an absolute path.
      migrationFolder: __dirname,
    }),
  })

  const {error, results} = await migrator.migrateToLatest()

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`migration "${it.migrationName}" was executed successfully`)
    }

    if (it.status === 'Error') {
      console.error(`failed to execute migration "${it.migrationName}"`)
    }
  })

  if (error) {
    console.error('failed to migrate')
    console.error(error)
    process.exit(1)
  }

  await db.destroy()
}

void migrateToLatest()
