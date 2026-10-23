# Note Recovery and Trash

**Status:** Phases 1–3 implemented (2026-10-23). Trash and recovery ship together; deployed cleanup remains Phase 4.

## Behavior

- Move saved notes to Trash for **30 days**, without confirmation. Editor deletion atomically saves the current title/body/theme; close on success without saving again. Retain drafts on failure.
- Trash shows newest first, with title/excerpt, expiry, read-only preview, Restore, and confirmed Delete permanently.
- Restore preserves content, theme, flags, ID, and creation date; return to Notes without opening an editor.
- Ordinary, modal, full, and API reads cannot expose trashed, expired, missing, or foreign-owned notes.
- Provide EN/VI text, pending/error/empty states, and Trash links in Notes (including its empty state) and desktop/mobile navigation. Follow [DESIGN.md](../DESIGN.md).

Excluded: bulk actions/Empty Trash, search, configurable retention, version history, archive management, offline mutation queues, account deletion, and recovery of previously hard-deleted notes.

## Data contract

Reuse `pendingDeleteAt` as the permanent-deletion **deadline**, independent of `isArchived`.

| State | Predicate | Operations |
| --- | --- | --- |
| Active | Deadline is null | Normal read/edit, trash |
| Recoverable | Deadline > database time | Trash read, restore, permanent delete |
| Expired | Deadline ≤ database time | Cleanup only |

- Derive ownership from `requireAuth().userInfo.id`; validate IDs and filter every operation by owner/state. Generic edits allow only title/content/theme.
- Use conditional writes and inspect affected rows. Repeated trash cannot extend retention or overwrite its first draft. Metadata survives; the existing trigger may advance `updatedAt`.
- Retention is exactly **2,592,000 elapsed seconds**, using the database clock. Recovery ends at expiry even if cleanup is delayed.
- Restore/delete require the unchanged **`deadlineToken`** (UTC ISO, six fractional digits). JavaScript `Date` loses precision. Reject stale-cycle tokens.
- Outcomes: `success`, `already_applied`, `unavailable`, `conflict`, `invalid_input`, `retryable_error`. Never disclose foreign rows or infer unrecorded completion. General content versioning is excluded.

## Phase 1 delivered

[Repository](../db/repositories/notes.ts), [actions](../app/[locale]/(note)/eton/actions.ts), and [validation](../lib/notes/validation.ts) enforce the contract. Lifecycle helpers remain internal. Note reads are fresh; successful actions invalidate owner-scoped active/trash/detail tags. API responses use `private, no-store`. Existing editors retain failed drafts and provide localized errors, accessible fields, and locale-aware navigation.

The [index migration](../drizzle/20261023052245_note_recovery_indexes/migration.sql) was tested **only in the disposable database**; app/production migration is pending. Local audit: **4 notes, zero deadlines**, unchanged after fixture cleanup. Audit legacy deadlines and index-locking impact on each deployment target before rollout.

## Phases 2–3 delivered

- Authenticated lifecycle actions replace active-note hard deletion in cards and both editors. Trashing snapshots the latest draft; failure keeps it open, success leaves without another save.
- `/trash` and `/trash/[id]` provide owner-scoped lists, safe read-only previews, restore, and named permanent-delete confirmation outside the modal layout.
- EN/VI navigation, empty/pending/error/offline states, note hues, accessible dialogs, and local expiry display are included. Focus, visibility, reconnect, and nearest-deadline events refresh eligibility using database time.
- The service worker excludes note HTML/RSC/API reads and mutations from caching, removes legacy cached note responses, and filters unresolved route templates from precaching. No note bodies enter the appearance store.

## Phase 4: cleanup

Choose/configure a daily deployment scheduler. Use a secret-protected endpoint and server-only bounded batches that recheck due deadlines, tolerate retries/overlaps, invalidate affected tags, and log counts/failures without bodies. Exclude the endpoint from service-worker caching. Test boundaries, delayed cleanup, batch limits, overlaps, and unauthorized calls; verify the deployed schedule before claiming automatic deletion. Copy: “Recover within 30 days.”

## Verification

**15 regression tests, 1 HTTP test, lint, build, and formatting pass**. Coverage includes two owners, validation, preservation, expiry, stale tokens, races, read freshness, Trash visibility, summaries, and network policy. A production-worker browser check verified installation, selective legacy-cache removal, offline note read/mutation rejection, and reconnect. UI review passed EN/VI, 390/768/1440, light/dark, atomic modal draft/theme trash (one request), full-editor failure/retry, read-only preview, restore, and confirmed permanent-delete failure/retry. Full keyboard traversal, extra presets, and live expiry timing remain unverified in-browser; expiry and read denial are covered by automated tests.

```sh
# Dedicated loopback DB with _test in its name; never the app DB
NOTES_TEST_DATABASE_URL='postgresql://USER:PASSWORD@localhost:5432/note_recovery_test' pnpm test:notes
# Running dev app and existing qa@test.dev; cleans its own fixture
NOTES_TEST_ORIGIN=http://localhost:3000 pnpm exec dotenv -e .env.local -- pnpm test:notes:http
# Read-only audit of the chosen environment
pnpm exec dotenv -e .env.local -- pnpm db:audit:notes
pnpm lint
pnpm build
```

Follow AGENTS.md for build permissions and QA provisioning. Repeated `(.)` prefixes in dev modal IDs indicate accumulated hot-reload rewrites: restart the server, never weaken ID validation. Archive this plan after the feature and deployed cleanup are complete.
