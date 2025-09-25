import {readMigrationFiles} from 'drizzle-orm/migrator'
/** @ts-expect-error this file will be executed directly via Node and it requires that imported TS paths need file extensions */
import drizzleConfig from '../drizzle.config.ts'
;(() => {
  if (!drizzleConfig.out) {
    console.error('No migrations output folder specified in drizzle.config.ts')
    process.exit(1)
  }

  const migs = readMigrationFiles({
    ...drizzleConfig,
    migrationsFolder: drizzleConfig.out,
  })

  for (const m of migs) {
    console.log(m.hash)
  }
})()

// About drizzle.__drizzle_migrations table records: it need to match `_journal.json` file for migrations orders, hashes, and `created_at` timestamp.

// Messed up the migration history in drizzle.__drizzle_migrations table and wanna force re-sync with current history?
// -> https://github.com/drizzle-team/drizzle-orm/discussions/1604#discussioncomment-12194312
