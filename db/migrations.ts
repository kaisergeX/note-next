import {type Kysely, sql} from 'kysely'
import {type Database} from './kysely'

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'serial', (cb) => cb.primaryKey())
    .addColumn('name', 'varchar(255)', (cb) => cb.notNull())
    .addColumn('email', 'varchar(255)', (cb) => cb.notNull().unique())
    .addColumn('image', 'varchar(255)')
    .addColumn('createdAt', sql`timestamp with time zone`, (cb) =>
      cb.defaultTo(sql`current_timestamp`),
    )
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('users').execute()
}
