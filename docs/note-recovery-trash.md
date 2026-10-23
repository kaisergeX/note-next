# Note Recovery and Trash

**Status:** Phase 1 complete (2026-10-23). Trash UI and cleanup are pending. Existing delete buttons still permanently delete owned active notes.

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

## Next: phases 2–3 together

1. Expose authenticated lifecycle actions using the existing helpers/outcomes/tags; replace temporary active-note hard deletion in cards and both editors.
2. Add `app/[locale]/(note)/trash/page.tsx` and `trash/[id]/page.tsx` outside the `eton` modal layout. Register `/trash` in [auth configuration](../config/auth.ts); authenticate pages/actions independently.
3. Build list, safe read-only preview, restore, named irreversible-delete confirmation, navigation, and localized feedback. Preserve note hues.
4. Refresh on focus/visibility return and nearest expiry. Any future content cache must enforce owner isolation, transition invalidation, and current eligibility.
5. Audit [service-worker caching](../app/sw.ts) for note HTML/RSC/API responses and verify offline/reconnect behavior. Do not persist bodies or trash mutations in the appearance store.

**Release gate:** ship trashing and recovery UI together. Verify draft → trash → preview → restore in both editors, confirmation cancel/confirm, empty states, stale requests, failure/retry, and ordinary/modal/full/API visibility. Run the required `ui-build` review.

## Phase 4: cleanup

Choose/configure a daily deployment scheduler. Use a secret-protected endpoint and server-only bounded batches that recheck due deadlines, tolerate retries/overlaps, invalidate affected tags, and log counts/failures without bodies. Exclude the endpoint from service-worker caching. Test boundaries, delayed cleanup, batch limits, overlaps, and unauthorized calls; verify the deployed schedule before claiming automatic deletion. Copy: “Recover within 30 days.”

## Verification

Phase 1 passed **12 regression tests, 1 HTTP test, lint, build, formatting, and browser review**. Coverage includes two owners, payload/ID validation, preservation, expiry, stale tokens, races, and read freshness. Browser coverage: EN/VI, 390/768/1440, Paper & Ink light/dark. Other presets and rapid Escape during loading remain unverified.

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
