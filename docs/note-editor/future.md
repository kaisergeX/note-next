# Future constraints: encryption, offline operation, and drawing

Status: deferred design. These notes preserve intent and identify future decisions; they do not authorize implementation.

## E2EE intent

Opt-in protection for individual note bodies: only a user with the decryption keys can read the body; the service must not possess those keys. Titles remain rich text and unencrypted by explicit product direction. Explain that titles and necessary metadata remain visible to the service.

HTML is compatible with E2EE: serialize locally, encrypt on the device, store ciphertext, decrypt/render locally. Encryption does not make rendered HTML safe. Key distribution, recovery, authentication, browser security, and safe rendering still need their own design.

### Boundaries to preserve now

- Separate editor/session behavior from persistence so body transformation can occur before transport and local durable storage.
- Keep title/body separable. Keep concurrency metadata usable without reading body contents.
- Compare and resolve content conflicts on the client. Avoid requiring server parsing of every body for core saves.
- Do not introduce body logging, analytics payloads, or plaintext recovery copies as permanent architectural requirements.
- Later search must distinguish server-searchable unencrypted notes/titles from protected bodies searched on an unlocked client.
- Use the existing encryption flag only according to a future defined protocol; a boolean alone is not encryption. Do not advertise encrypted notes before protection is implemented.

Do not add speculative cryptographic columns, key storage, or encryption dependencies in the editor/autosave stages.

### Encryption transition and old history

The owner is open to warning that enabling E2EE discards pre-encryption revision history. This is a **candidate policy for later discussion**, not an accepted deletion action or a complete design.

Current autosave revision tokens do not require storing historical bodies. If user-visible history is introduced later, decide whether enabling E2EE deletes old snapshots or encrypts them on an unlocked client. Define confirmation, failure recovery, concurrent writes, local drafts/caches, exports, and disabling encryption.

Deleting live history cannot retroactively erase plaintext from historical backups, logs, or previously exported copies. Do not promise retroactive secrecy. No deletion or encryption migration is authorized by this document.

### Decisions required before E2EE implementation

- Key generation, per-note versus account key hierarchy, multi-device onboarding, offline unlock, locking behavior, and recovery when keys are lost.
- Authenticated encryption format/version, key rotation, retry handling, and binding ciphertext to the correct note/account.
- Metadata visibility, plaintext title disclosure, local encrypted drafts and reconciliation baselines.
- Atomic enable/disable transitions and stale-client behavior; no mixed plaintext/ciphertext writes during migration.
- Server validation limits without plaintext access; client rendering validation after decryption.
- Backup/history retention and exact user-facing privacy promises.

Use established cryptographic tooling/protocols and a dedicated security review. Do not invent a protocol as an incidental editor feature. [Web Crypto authenticated encryption background](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt).

## Full offline support

Local recovery is the first step, not full offline capability. Existing protected-response cache exclusions are intentional; do not remove them to make routes appear offline-capable.

A separate design must cover an offline-launchable shell, locally available notes/list data, account isolation, a durable mutation queue, idempotent creation/deletion, remote tombstones, expired authentication, reconnect reconciliation, browser storage eviction, and logout/account deletion behavior. Background synchronization cannot be assumed to run while the app is closed.

Future E2EE requires encrypted local bodies with an explicit unlock model. Browser persistence requests can improve retention but are not guaranteed backups. [Storage persistence documentation](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist).

## Search

Deferred from this editor/autosave roadmap. User intent is title/content search from the notes list. Determine performance and indexing based on actual collection sizes; distinguish encrypted-body search before committing to a server-only design. No Redis requirement follows from search alone.

## Drawing

Potential separate document/editor type with its own content format, interactions, and undo model. Reuse ownership and persistence boundaries where appropriate. Embedded sketches could reference separate drawing documents later. This possibility does not justify changing current HTML storage or building a generalized document framework now.
