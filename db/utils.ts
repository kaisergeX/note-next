import {db} from '.'
import {sql} from 'drizzle-orm'

export const ULIDGenerateFunction = db.execute(sql`
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  CREATE OR REPLACE FUNCTION generate_ulid() RETURNS uuid
    AS $$
        SELECT (lpad(to_hex(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint), 12, '0') || encode(gen_random_bytes(10), 'hex'))::uuid;
    $$ LANGUAGE SQL;
`)

/**
 * DB Function: Each time a row data is updated, the `updated_at` column will be updated automatically.
 */
export const UpdatedAtFunction = db.execute(sql`
  CREATE OR REPLACE FUNCTION upd_updated_at_stamp() RETURNS TRIGGER AS $upd_updated_at_stamp$ 
    BEGIN
      IF row(NEW.*) IS DISTINCT FROM row(OLD.*) THEN 
        NEW.updated_at = now();
        RETURN NEW;
      ELSE
        RETURN OLD;
      END IF;
    END;
  $upd_updated_at_stamp$ LANGUAGE plpgsql;
`)

/**
 * Applied {@link UpdatedAtFunction upd_updated_at_stamp()} to all tables that belong to public schema (default schema)
 * and have the `updated_at` column.
 */
export const AddUpdatedAtTrigger = db.execute(
  sql.raw(`
    DO $$
    DECLARE
      tbname text;
    BEGIN
      FOR tbname IN 
        SELECT table_name 
        FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'updated_at'
      LOOP
        EXECUTE format(
          'CREATE OR REPLACE TRIGGER upd_updated_at_stamp 
              BEFORE UPDATE 
              ON %I 
              FOR EACH ROW 
              EXECUTE FUNCTION upd_updated_at_stamp()', 
              tbname);
      END LOOP;
    END;
    $$ LANGUAGE plpgsql;
  `),
)

/**
 * This is a one-time migration script to change the "users.id" column type from serial to uuid.
 * ___
 * ⚠️ DO NOT run this without a backup of your data. It permanently throws away the old values in the "users.id" column.
 * Avoid using this script if can!
 *
 * ✅ A better approach is usually to add a uuid column separately,
 * then fix up any foreign key references that point to it, and finally drop the original column.
 * ___
 * @usage
 * @example
 * async function migrate() {
 *    await ULIDGenerateFunction;
 *    await UNSAFE_MigrateSerialToUUID;
 * }
 */
export const UNSAFE_MigrateSerialToUUID = db.execute(sql`
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'users') THEN
      EXECUTE '
        ALTER TABLE "users" ALTER COLUMN "id" DROP DEFAULT;
        ALTER TABLE "users" ALTER COLUMN "id" SET DATA TYPE uuid USING (generate_ulid());
        ALTER TABLE "users" ALTER COLUMN "id" SET DEFAULT generate_ulid();
      ';
    END IF;
  END;
  $$;
`)
