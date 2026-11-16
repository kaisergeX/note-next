# Encryption operator handoff

Prepared 2026-11-16 for local candidate `209ae968c720f63bcc5075ee43782bcb6ff0557a`. This is a rehearsal checklist, not deployment authorization. The release verdict remains **NO-GO**; enrollment and creation stay disabled by default.

## Evidence already available locally

The [release ledger](note-encryption-release-readiness.md) and [tested source manifest](note-encryption-release-source.json) are authoritative. At the start of this follow-up, all 89 exact-byte source hashes and the retained production build `TW1Axqn5MoWv9bjgLTFW7` matched. The following successful rehearsals are existing evidence, not newly repeated runs:

| Rehearsal | Existing local evidence | What still needs the actual operator |
| --- | --- | --- |
| Additive migrations and legacy-row refusal | `scripts/note-encryption-migration-rehearsal.mjs`; clean/Trash rows retained, idempotent rerun, legacy refusal atomic, synthetic quarantine retains original bytes | Read-only inventory on the intended environment; owner-approved preservation/quarantine plan if legacy rows exist; actual migration privileges and execution order |
| Previous client and retained browser work | `scripts/note-encryption-upgrade.mjs`; previous client ordinary save and upgraded unsynced draft with flags closed | Hosting/client rollout ordering and supported old-client inventory |
| PostgreSQL archive recovery | `scripts/note-encryption-backup-rehearsal.mjs`; three independent fresh-browser recoveries on November 16 final build | Backup access, retention, encryption/access controls, restore privileges, and recovery on the intended hosting stack |
| Closed rollout flags | Existing encrypted restore/edit/sync/relock succeeds with enrollment and creation disabled | Actual environment values, propagation/caching behavior and operator ownership |
| Ciphertext boundary | Local synthetic worker/network/storage/SSR/database sentinel audit | Reverse proxy, hosting logs, error reporting and analytics collectors on the intended environment |

Do not repeat the full passing matrix merely to fill out this document. Rerun relevant checks when source, migrations, deployment settings, dependencies or the tested environment change. Local runners must use generated disposable loopback databases; their cleanup must never target the shared development database.

## Production-like rehearsal to be recorded by its owner

1. Identify the exact source manifest, build ID, additive migration set and hosting configuration. Record both feature flags. Do not enable either flag as part of a rehearsal.
2. With approved read-only database access, count unsupported legacy rows without retrieving note contents. Before the additive migration, the relevant legacy predicate is `is_encrypted = true`; after it, distinguish proper ciphertext records from legacy rows using the actual installed schema. An aggregate count is sufficient for initial triage. Do not clear flags, delete rows or invent wrappers to make migration pass.
3. Verify a restorable backup and access to both backup and restore tooling. Restore into an isolated target and verify synthetic ordinary notes, Trash and encrypted notes. Recover using the saved recovery kit in a fresh profile; a database restore alone does not prove that the user can decrypt. Never-uploaded browser work is outside database backup coverage.
4. Rehearse migrations and server protections before updated clients. Exercise ordinary writes from the previous client for a vault-free account. A legacy-row refusal stops the process until the owner approves preservation and quarantine; the local synthetic quarantine example is not approval for real rows.
5. Through the actual proxy, exercise accepted maximum-size synthetic encrypted writes and bodies just over the application limit. Record HTTP status, whether the app was reached, and whether the preceding note/checkpoint remains intact. Include vault and note endpoint limits; do not assume the proxy accepts a body merely because local Next.js did.
6. Use unique synthetic title/body/passphrase/recovery sentinels, then inspect request URLs/bodies, SSR/RSC, browser storage, database plaintext/search columns and the actual server/proxy/error/analytics logs. Restrict artifacts and remove disposable accounts/data afterward. Do not print secrets into a broadly accessible report; record findings and surface coverage instead.
7. Disable new enrollment and creation after a synthetic encrypted note exists. Verify ordinary create/edit/search and existing encrypted unlock/read/edit/sync/recovery/delete. Record environment propagation and results. Keep existing encrypted access available.
8. Record the roll-forward procedure and responsible operator. Once ciphertext or newer strict recovery records exist, a plaintext-only server or an older incompatible recovery client is not a safe rollback. Do not use destructive schema rollback or automatic decryption.

### Inventory for the proposed signing-key migration

The legacy-note count in step 2 cannot establish whether users already have vaults. A user can complete enrollment and never save an encrypted note. On an installation with the checked-in vault schema, the operator can use the following read-only aggregate without retrieving user identities or wrapped keys.

```sql
SELECT count(*) AS v1_vaults FROM note_vaults WHERE format_version = 1;
```

Record the environment, schema revision, time and count. If the vault table is absent, record the installed migration state separately. A positive count requires a reviewed path for binding those existing vaults to their first verifier while preserving recovery. A zero count can support new-vault-only enrollment on that installation if operators also verify that V1 enrollment cannot create a vault between the inventory and rollout. Check the treatment of supported older deployments and restored backups separately. The independent review of the new enrollment protocol applies in either case.

The operator's report must name environment, source/build, date, responsible person, flags, actual commands/checks, outcomes and artifact locations. A skipped step remains open. Deployment, real Google authentication, physical credential providers, independent protocol review, real assistive technology and the EN/VI participant study require their own evidence; this handoff does not pass any of them.
