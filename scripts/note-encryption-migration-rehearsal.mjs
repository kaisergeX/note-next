import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {mkdtemp, mkdir, copyFile, readdir, rm} from 'node:fs/promises'
import {resolve, join} from 'node:path'
import postgres from 'postgres'
import {drizzle} from 'drizzle-orm/postgres-js'
import {migrate} from 'drizzle-orm/postgres-js/migrator'

// The app URL supplies local instance credentials only. All migrations, writes
// and cleanup target uniquely named disposable databases created by this run.
const instance = new URL(process.env.DATABASE_URL)
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(instance.hostname))
instance.pathname = '/postgres'
const admin = postgres(instance.toString(), {max: 1, onnotice: () => {}})
const root = resolve('.playwright-mcp')
await mkdir(root, {recursive: true})
const oldMigrations = await mkdtemp(join(root, 'release-migrations-'))
try {
  for (const name of await readdir('drizzle')) {
    if (!/^\d{14}_/.test(name) || name >= '20261110154137') continue
    await mkdir(join(oldMigrations, name))
    await copyFile(
      join('drizzle', name, 'migration.sql'),
      join(oldMigrations, name, 'migration.sql'),
    )
  }
  for (const legacy of [false, true]) {
    const name = `eton_test_migration_${randomUUID().replaceAll('-', '')}`
    await admin`CREATE DATABASE ${admin(name)}`
    const url = new URL(instance)
    url.pathname = `/${name}`
    const client = postgres(url.toString(), {max: 1, onnotice: () => {}})
    try {
      const db = drizzle({client})
      await migrate(db, {migrationsFolder: oldMigrations})
      const [owner] =
        await client`INSERT INTO users (name, email) VALUES ('Synthetic migration owner', ${`${randomUUID()}@test.invalid`}) RETURNING id`
      const rows =
        await client`INSERT INTO notes (author_id, title, content, pending_deleted_at, is_encrypted) VALUES
        (${owner.id}, 'Ordinary active', '<p>Original active</p>', null, false),
        (${owner.id}, 'Ordinary trash', '<p>Original trash</p>', now() + interval '1 day', false),
        (${owner.id}, 'Legacy flag sentinel', '<p>Preserve all original bytes</p>', null, ${legacy})
        RETURNING *`
      const before = JSON.stringify(
        await client`SELECT * FROM notes ORDER BY id`,
      )
      const migrationsBefore =
        await client`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`
      if (legacy) {
        await assert.rejects(
          migrate(db, {migrationsFolder: './drizzle'}),
          (error) => {
            assert.match(
              String(error.cause?.message ?? error.message),
              /Legacy is_encrypted notes require an owner-reviewed quarantine/,
            )
            return true
          },
        )
        assert.equal(
          JSON.stringify(await client`SELECT * FROM notes ORDER BY id`),
          before,
        )
        assert.deepEqual(
          await client`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`,
          migrationsBefore,
        )
        const [schema] =
          await client`SELECT to_regclass('note_vaults') AS vaults, EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'encrypted_payload') AS payload`
        assert.equal(schema.vaults, null)
        assert.equal(schema.payload, false)

        // Rehearsal only: simulate an owner-approved quarantine in this test DB.
        // Production requires a separately reviewed plan; no real row is moved.
        await client.begin(async (tx) => {
          await tx`CREATE TABLE release_quarantine (LIKE notes INCLUDING ALL)`
          await tx`INSERT INTO release_quarantine SELECT * FROM notes WHERE is_encrypted`
          await tx`DELETE FROM notes WHERE is_encrypted`
        })
        assert.deepEqual(
          (await client`SELECT * FROM release_quarantine`)[0],
          rows[2],
        )
      }
      const expected = JSON.stringify(
        await client`SELECT * FROM notes ORDER BY id`,
      )
      const start = performance.now()
      await migrate(db, {migrationsFolder: './drizzle'})
      const upgradeMs = performance.now() - start
      const after = await client`SELECT * FROM notes ORDER BY id`
      assert.equal(
        JSON.stringify(
          after.map(({vault_id, encrypted_payload, ...row}) => {
            assert.equal(vault_id, null)
            assert.equal(encrypted_payload, null)
            return row
          }),
        ),
        expected,
      )
      const count = (await client`SELECT * FROM drizzle.__drizzle_migrations`)
        .length
      assert.equal(count, migrationsBefore.length + 4)
      await migrate(db, {migrationsFolder: './drizzle'})
      assert.equal(
        (await client`SELECT * FROM drizzle.__drizzle_migrations`).length,
        count,
      )
      // Previous ordinary clients still write their known columns on the new schema.
      await client`UPDATE notes SET content = '<p>Old client ordinary edit</p>' WHERE id = ${rows[0].id}`
      assert.equal(
        (await client`SELECT content FROM notes WHERE id = ${rows[0].id}`)[0]
          .content,
        '<p>Old client ordinary edit</p>',
      )
      if (legacy)
        assert.deepEqual(
          (await client`SELECT * FROM release_quarantine`)[0],
          rows[2],
        )
      console.log(
        JSON.stringify({
          legacyFlag: legacy,
          result: 'passed',
          upgradeMs: Math.round(upgradeMs * 100) / 100,
          applied: count,
          ordinaryRowsPreserved: after.length,
          quarantineRowsPreserved: legacy ? 1 : 0,
          idempotentRerun: true,
          oldColumnWrite: true,
        }),
      )
    } finally {
      await client.end()
      await admin`DROP DATABASE ${admin(name)}`
    }
  }
} finally {
  await admin.end()
  assert.ok(
    oldMigrations.startsWith(`${root}\\`) ||
      oldMigrations.startsWith(`${root}/`),
  )
  await rm(oldMigrations, {recursive: true, force: true})
}
