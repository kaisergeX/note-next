# Autosave and local recovery

Status: Phase 2 planning only; not authorized or implemented. The Phase 1 [editor/session foundation](editor.md) is delivered; it still saves only on explicit close/back and keeps drafts in memory. Product decisions below remain open, and release depends on [revision/conflict protection](conflicts.md).

## Intended outcome

Protect work across refresh, navigation, and transient network failures while keeping typing responsive and server traffic bounded. Local persistence and server acknowledgement are separate facts; communicate both accurately.

## Proposed scheduling defaults

| Event | Proposed behavior |
| --- | --- |
| Content changes | Update memory; debounce local persistence around 500 ms with a short maximum wait, initially 2 seconds. |
| Typing pause | Schedule server save after 3 seconds without edits. |
| Frequent pauses | Minimum 10 seconds between scheduled server attempts for an editing session. |
| Continuous typing | Attempt within 30 seconds of the first unsynced edit, subject to an in-flight request or failure backoff. |
| Unchanged note | No save timer traffic or polling. |
| Explicit close/back/save | Flush newest pending changes through the same queue. |
| Page hidden | Best-effort persistence/flush; never rely on unload delivery. |
| Temporary failure | Retain draft; bounded retries with increasing delay and jitter; expose Retry. |

These timings need confirmation and measurement. Browser suspension, unavailable storage, or sudden termination can lose edits not yet persisted; do not promise zero loss.

Only one request per note session may be in flight. Coalesce subsequent changes into the newest pending snapshot. Acknowledgements update the baseline for the exact submitted snapshot, not the user's newer edits. Clear local recovery data only when the acknowledged generation is still the current generation.

## Status contract

- **Changes pending:** newest edits are not server-acknowledged.
- **Saving:** a request is in flight; typing remains available.
- **Saved:** server acknowledged the current content, with no newer changes.
- **Offline / saved on this device:** local persistence actually completed; do not infer this from a successful memory update.
- **Save failed / Retry:** preserve work and expose a recovery action.
- **Conflict:** pause server autosave for this note; local recovery continues.
- Distinguish expired authentication, rejected validation, unavailable/deleted note, and transient failures. Do not endlessly retry permanent failures.

## Local storage proposal

Dexie is the leading candidate for IndexedDB transactions and migrations; installation is not yet performed or locked in. Keep draft storage separate from the appearance store.

Persist account identity, note/stable creation identity, baseline revision and content needed for reconciliation, current draft, local generation, and recovery timestamps. Define per-tab/session coordination so tabs cannot overwrite each other's unsynced recovery drafts. Account scoping is isolation, not encryption.

Handle quota errors, unavailable storage, and failed schema upgrades visibly. Browser storage is recoverable working data, not a backup guarantee. Future protected-body drafts must be encrypted; see [future constraints](future.md).

## Server and retry contract to design

- Continue deriving ownership from authentication; preserve active-state predicates and owner transaction locks used by account deletion/bulk Trash.
- Add atomic expected-revision checks. Every competing content/lifecycle mutation must participate consistently; see [conflicts](conflicts.md).
- Give a new draft a stable creation identity. A committed create with a lost response must not create a second note on retry.
- Define idempotency/acknowledgement recovery for lost update responses too. Do not classify an identical already-committed save as a destructive conflict or claim success without evidence.
- Validate payload and size bounds server-side. Return a small acknowledgement where practical; avoid full-list reads/refreshes per keystroke or autosave.
- Reconcile visible list cards after leaving the editor. Inspect existing action cache invalidation/render behavior before changing it.
- Do not log titles, bodies, or database parameter dumps in metrics/errors.

## Resource budget

With a 10-second minimum interval, 20 minutes of sustained editing is approximately at most 120 scheduled attempts per session, plus explicit flushes/retries. Ten users doing that daily is approximately 36,000 scheduled attempts per 30 days. Multiple tabs and other application requests add traffic.

Requests are not SQL statement counts: current writes take an owner-locking transaction plus mutation, with authentication/other work potentially adding reads. Current note-list reads fetch full notes. Measure before optimizing or changing consistency contracts.

Vercel's documented Hobby Fluid compute allowances checked during planning were 1 million invocations, 4 CPU-hours, and 360 GB-hours of provisioned memory. They are independent limits, not proof this feature fits. Recheck [current limits](https://vercel.com/docs/functions/usage-and-pricing), deployment compute mode, existing usage, database plan, connection behavior, and latency. No Redis/write-behind worker is proposed.

Track counts, payload sizes, latency, failure/conflict rates, and list-read amplification without content. Do not add idle polling or full-document history snapshots on each save.

## Open product decisions

1. **Creation:** proposal is first scheduled save with meaningful content; empty open/close creates nothing. Define meaningful content structurally, not by HTML string truthiness. Once created, closing means leaving. Decide whether an explicit discard moves the saved note to Trash.
2. **Logout/account switch:** proposal is warn about unsynced work and allow retry/export/explicit discard; clear acknowledged local copies. Final retention and recovery behavior remain undecided.
3. **Navigation failure:** decide whether app-controlled navigation waits or permits leaving after durable local recovery. Native tab close cannot reliably wait for an async request.
4. **Recovery retention and reopening:** define draft discovery, recovery UI, expiration, and what happens after a remote deletion/account deletion.
5. **Production budget:** confirm database provider/plan and active editing volume. README's Neon reference is not production configuration evidence.

## Acceptance checklist

- [ ] No-op/open-only sessions produce no writes; pause/max-wait/minimum-interval behavior verified.
- [ ] Typing during a request survives acknowledgement and follows with the latest snapshot.
- [ ] Lost create/update responses and retries do not duplicate notes or overwrite newer revisions.
- [ ] Refresh recovery, storage failure, offline/reconnect, authentication expiry, and multiple tabs covered.
- [ ] Trash/account deletion races do not resurrect notes or leak foreign/deleted content.
- [ ] Status never claims persistence ahead of actual local/server acknowledgement.
- [ ] List reads and request volume measured with representative editing.

References: [Dexie](https://dexie.org/docs/API-Reference), [browser unload limitations](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event).
