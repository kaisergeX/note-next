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
const preAuthorization = await mkdtemp(join(root, 'authorization-migrations-'))
try {
  for (const name of await readdir('drizzle')) {
    if (/^\d{14}_/.test(name) && name < '20261117165118') {
      await mkdir(join(preAuthorization, name))
      await copyFile(
        join('drizzle', name, 'migration.sql'),
        join(preAuthorization, name, 'migration.sql'),
      )
    }
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
      await migrate(db, {migrationsFolder: preAuthorization})
      const vaultId = randomUUID()
      const setupId = randomUUID()
      const [originalVault] = await client`INSERT INTO note_vaults
        (id, owner_id, setup_id, last_operation_id, primary_wrapper, recovery_wrapper)
        VALUES (${vaultId}, ${owner.id}, ${setupId}, ${setupId},
          ${JSON.stringify({sentinel: 'original primary bytes'})},
          ${JSON.stringify({sentinel: 'original recovery bytes'})}) RETURNING *`
      await migrate(db, {migrationsFolder: './drizzle'})
      const [upgradedVault] =
        await client`SELECT * FROM note_vaults WHERE id = ${vaultId}`
      const {authorization_version, authorization, ...preservedVault} =
        upgradedVault
      assert.equal(authorization_version, 0)
      assert.equal(authorization, null)
      assert.deepEqual(preservedVault, originalVault)
      const [newOwner] = await client`INSERT INTO users (name, email)
        VALUES ('Synthetic authorization owner', ${`${randomUUID()}@test.invalid`}) RETURNING id`
      const newVaultId = randomUUID()
      const [authorizedVault] = await client`INSERT INTO note_vaults
        (id, owner_id, setup_id, last_operation_id, primary_wrapper, recovery_wrapper, authorization_version, "authorization")
        VALUES (${newVaultId}, ${newOwner.id}, ${randomUUID()}, ${randomUUID()},
          ${JSON.stringify({sentinel: 'new primary'})}, ${JSON.stringify({sentinel: 'new recovery'})},
          1, ${JSON.stringify({version: 1, sentinel: 'pinned authorization'})}) RETURNING *`
      // Database fixtures test additive migration/constraints, not crypto validity.
      for (const current of [upgradedVault, authorizedVault]) {
        for (const patch of [
          {setup_id: randomUUID()},
          {recovery_wrapper: {sentinel: 'substituted recovery'}},
          {
            authorization_version: 1,
            authorization: {version: 1, sentinel: 'substituted verifier'},
          },
        ]) {
          await assert.rejects(
            client.begin(async (tx) => {
              await tx`UPDATE notes SET title = 'Must roll back' WHERE id = ${rows[0].id}`
              await tx`UPDATE note_vaults SET ${tx(Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value) : value])))} WHERE id = ${current.id}`
            }),
            /Pinned vault authorization and recovery state is immutable/,
          )
          assert.deepEqual(
            (
              await client`SELECT * FROM note_vaults WHERE id = ${current.id}`
            )[0],
            current,
          )
          assert.equal(
            (await client`SELECT title FROM notes WHERE id = ${rows[0].id}`)[0]
              .title,
            rows[0].title,
          )
        }
      }
      await assert.rejects(
        client`INSERT INTO note_vaults
        (id, owner_id, setup_id, last_operation_id, primary_wrapper, recovery_wrapper, authorization_version)
        VALUES (${randomUUID()}, ${randomUUID()}, ${randomUUID()}, ${randomUUID()}, '{}', '{}', 1)`,
        /note_vaults_authorization_check/,
      )
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
      assert.equal(count, migrationsBefore.length + 5)
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
          legacyVaultBytesPreserved: true,
          legacyAuthorizationVersion: 0,
          pinnedStateRollbackChecks: 6,
        }),
      )
    } finally {
      await client.end()
      await admin`DROP DATABASE ${admin(name)}`
      assert.equal(
        (await admin`SELECT 1 FROM pg_database WHERE datname = ${name}`).length,
        0,
      )
    }
  }
} finally {
  await admin.end()
  assert.ok(
    oldMigrations.startsWith(`${root}\\`) ||
      oldMigrations.startsWith(`${root}/`),
  )
  await rm(oldMigrations, {recursive: true, force: true})
  assert.ok(
    preAuthorization.startsWith(`${root}\\`) ||
      preAuthorization.startsWith(`${root}/`),
  )
  await rm(preAuthorization, {recursive: true, force: true})
}
