# Encryption operator handoff

Updated 2026-11-18. Local source commit `b8a6e54e90821433c9f26023b37a147aead22b6b` requires pinned root-authorized signatures for primary unlock replacement. Production and real-note beta release remain blocked. Enrollment and creation stay disabled by default. The earlier baseline below is local commit `209ae968c720f63bcc5075ee43782bcb6ff0557a`. [Current verification and release gates](note-encryption-release-readiness.md#current-pr-scope)

## Evidence already available locally

The [release ledger](note-encryption-release-readiness.md) records the current candidate. The [tested source manifest](note-encryption-release-source.json) records the historical November 16 snapshot. At the start of the earlier follow-up, all 89 exact-byte source hashes and retained production build `TW1Axqn5MoWv9bjgLTFW7` matched. The following successful rehearsals are existing evidence; the current candidate's repeated checks are listed separately in the ledger:

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

### Authorization-aware backup and upgrade

The additive authorization migration preserves existing wrappers and marks existing vaults version 0. New enrollment requires version 1; old setup clients cannot enroll a new vault. Version-0 vaults retain unlock/recovery but cannot replace their primary. There is no session-only verifier bootstrap, signer repair or reset endpoint. Preserve real legacy vaults pending a reviewed policy; the owner's disposable-local-vault statement is not an operator deletion policy.

A consistent backup must include authorization version, pinned verifier, encrypted signer artifact, immutable setup/recovery state and all accepted-operation receipts together with encrypted notes. Keep receipts for the vault lifetime under this implementation. Restore them together into an isolated target, recover in a fresh profile, and exercise signed replacement and historical receipt reconciliation. Missing/corrupt signer state blocks replacement while ordinary recovery must still open retained notes. Do not generate a verifier to make restoration pass. A database writer, copied root and whole-state rollback remain outside this protection. Older servers must not serve authorization-required replacement.

The November 18 disposable migration rehearsal passed clean and legacy-refusal/quarantine paths with all 20 migrations. It preserved a pre-authorization vault's original columns and assigned version 0/null authorization, checked new version-1 state, and verified six pinned-state rejections per path roll back an earlier note write atomically. Idempotent rerun and previous-client ordinary writes passed; both generated databases were dropped and absence verified. These synthetic fixtures establish local migration behavior, not the actual deployment's vault inventory or privileges.

### Inventory for the signing-key migration

The legacy-note count in step 2 cannot establish whether users already have vaults. A user can complete enrollment and never save an encrypted note. On an installation with the checked-in vault schema, the operator can use the following read-only aggregate without retrieving user identities or wrapped keys.

```sql
BEGIN READ ONLY;
SET LOCAL row_security = off;
SELECT count(*) AS v1_vaults FROM public.note_vaults WHERE format_version = 1;
COMMIT;
```

Run the transaction on the authoritative database with the application's installed schema (`public` in the local fixture). PostgreSQL will fail the query if a row-security policy would hide vaults from the operator. A permission error, missing table, replica count or interrupted transaction cannot establish that there are zero vaults. Record a count only after the transaction completes successfully. An operator can use `psql -v ON_ERROR_STOP=1` to make a failed statement stop a scripted rehearsal.

On November 17, a disposable PostgreSQL database returned `42P01` before migration, zero after migration, and one after inserting a synthetic V1 vault whose owner had zero encrypted notes. A role without table read access received `42501`. A read role subject to row-level security returned a misleading zero with the default setting, then received `42501` from the transaction above. The authorized role continued to count one. The fixture database was removed and its absence verified. These results apply to the local rehearsal only.

Record the environment, schema revision, time and count. If the vault table is absent, record the installed migration state separately. A positive count requires a reviewed path for binding those existing vaults to their first verifier while preserving recovery. A zero count can support new-vault-only enrollment on that installation if operators also verify that V1 enrollment cannot create a vault between the inventory and rollout. Check the treatment of supported older deployments and restored backups separately. The independent review of the new enrollment protocol applies in either case.

The operator's report must name environment, source/build, date, responsible person, flags, actual commands/checks, outcomes and artifact locations. A skipped step remains open. Deployment, real Google authentication, physical credential providers, independent protocol review, real assistive technology and the EN/VI participant study require their own evidence; this handoff does not pass any of them.

### Physical-device and participant session

Use a disposable account and synthetic notes on the authorized test environment. Record the candidate build, phone model, OS, browser, locale, and passkey provider. For an assistive-technology session, include the screen reader and its version. Let the participant handle test credentials privately. Record outcomes and spoken status labels, and leave secret values out of observations, recordings and transcripts.

| Give the participant this task | Vietnamese prompt | Observe before giving help |
| --- | --- | --- |
| Set up private notes. Make a note you can recognize later. | Hãy thiết lập ghi chú mã hóa rồi tạo một ghi chú mà bạn có thể nhận ra sau này. | Did they complete setup, save recovery material and identify when the note synced? |
| Lock your notes, then open the same note again. | Hãy khóa các ghi chú rồi mở lại ghi chú vừa tạo. | Did they reach the same title and body? Could they identify the current lock and sync states? |
| Your original unlock method is unavailable. Open the same note on this fresh test device or browser profile. | Giả sử bạn không còn dùng được cách mở khóa ban đầu. Hãy mở lại ghi chú đó trên thiết bị thử nghiệm hoặc hồ sơ trình duyệt mới này. | Provision account access in advance. Supply only the test material the participant chose to keep. Record whether they recovered the synced note without the original credential. |
| With this editor already open and offline, change the note. Where is that change available now? What if you lose all your ways to unlock the vault? | Khi trình soạn thảo đang mở và thiết bị đã ngắt mạng, hãy sửa ghi chú. Lúc này bạn có thể xem phần vừa sửa ở đâu? Điều gì sẽ xảy ra nếu bạn mất tất cả các cách mở khóa kho ghi chú? | Record the initial answers. Reconnect and observe whether they recognize sync. If clarification is needed, record it and retest comprehension. |

Score task completion per person as unassisted, assisted or incomplete. Apply the [plan's usability threshold](note-encryption-plan.md): at least five participants across mobile and EN/VI, at least four completing setup, encrypted-note creation/unlock and recovery unassisted, and all understanding local-only work and secret loss after clarification/retest. With an actual screen reader, also exercise a sign-in pause and explicit resume. Record focus order, control names and the status spoken after each transition. Record a device/provider case or participant session as completed only after observing it.
