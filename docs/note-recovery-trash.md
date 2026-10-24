# Note Recovery and Trash

**Status (2026-10-24):** Phases 1–4 are deployed and locally verified. Production recovery, manual cleanup, and endpoint protection pass. An automatic scheduled invocation remains unverified.

## Pending closeout

- [ ] Confirm an automatic invocation in Vercel Cron Jobs → View Logs; record its timestamp. Manual Run does not prove scheduling. HTTP 200 with `ok: true` and zero deletions is valid.
- [ ] Then move this document to `docs/archive/`, fix its relative links, and mark the [README roadmap](../README.md) complete.

## Behavior and scope

- Move saved notes to Trash for **30 days**, without confirmation. Editor trash atomically saves the current title/body/theme; success closes without another save, while failure retains the draft.
- `/trash` lists newest first with title/excerpt, expiry, read-only preview, Restore, and named, confirmed Delete permanently. `/trash/[id]` is separate from the note modal layout.
- Restore preserves content, theme, flags, ID, and creation date, then returns to Notes without opening an editor.
- Ordinary, modal, full-page, and API reads deny trashed, expired, missing, or foreign-owned notes. Expiry ends access even when physical cleanup is delayed.
- EN/VI include empty/pending/error/offline states and local expiry display. All notes / Recently deleted use a desktop sidebar and mobile selector. Eligibility refreshes on focus, visibility, reconnect, and the nearest deadline.

Excluded: bulk actions/Empty Trash, search, configurable retention, version history, archive management, offline mutation queues, account deletion, and recovery of previously hard-deleted notes. Visual rules live in [DESIGN.md](../DESIGN.md).

## Data contract

`pendingDeleteAt` is the permanent-deletion **deadline**, independent of `isArchived`.

| State       | Predicate                | Operations                            |
| ----------- | ------------------------ | ------------------------------------- |
| Active      | Deadline is null         | Normal read/edit, trash               |
| Recoverable | Deadline > database time | Trash read, restore, permanent delete |
| Expired     | Deadline ≤ database time | Cleanup only                          |

- Derive ownership from `requireAuth().userInfo.id`; validate IDs and filter every operation by owner/state. Generic edits accept only title/content/theme.
- Conditional writes inspect affected rows. Repeated trash cannot extend retention or overwrite the first draft. Metadata survives; the existing trigger may advance `updatedAt`.
- Retention is exactly **2,592,000 elapsed seconds**, using the database clock.
- Restore/delete require the unchanged `deadlineToken`: UTC ISO with six fractional digits. JavaScript `Date` loses precision; stale-cycle tokens must be rejected.
- Outcomes: `success`, `already_applied`, `unavailable`, `conflict`, `invalid_input`, `retryable_error`. Never disclose foreign rows or infer unrecorded completion. General content versioning is excluded.

## Implementation

- [Owner-scoped repository](../db/repositories/notes.ts), [actions](<../app/[locale]/(note)/eton/actions.ts>), and [validation](../lib/notes/validation.ts) enforce the contract. Successful actions invalidate owner active/trash/detail tags; reads remain fresh and API responses use `private, no-store`.
- [Recovery index migration](../drizzle/20261023052245_note_recovery_indexes/migration.sql) adds owner-trash ordering and due-expiry indexes. The owner confirmed production migration complete on 2026-10-24.
- [Service worker](../app/sw.ts) excludes protected note HTML/RSC/API reads, mutations, and cleanup from caching, removes legacy cached note responses, and excludes unresolved route templates from precaching. Note bodies never enter the appearance store.
- Cleanup uses the [endpoint](../app/api/cron/note-cleanup/route.ts), [runner](../lib/notes/cleanup.ts), [repository](../db/repositories/note-cleanup.ts), and [schedule](../vercel.json).

## Cleanup operation

- Daily `GET /api/cron/note-cleanup` at **03:00 UTC / 10:00 Asia/Saigon**. On Vercel Hobby, invocation may occur from 10:00–10:59. See [cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs) and [timing limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
- Production `CRON_SECRET` provides Bearer authentication with constant-time digest comparison. Missing secret returns 503, unauthorized GET 401, and HEAD/other methods 405. Responses are private/no-store; logs and responses contain counts/status only.
- Each invocation runs at most five batches of 100 rows, checking a 20-second budget between batches. Transactions use 5-second statement and 500ms lock timeouts, database deadlines, `FOR UPDATE SKIP LOCKED`, and a deletion eligibility recheck. Owner list/trash/detail invalidation occurs before commit; invalidation failure rolls back that batch. Retries and concurrent workers are safe.
- `bounded: true` may require later runs to drain a backlog. `bounded: false` can still leave rows locked by another transaction. Investigate failures; Vercel does not automatically retry them.
- Zero deletions is valid. Expired production fixtures are unnecessary; audit legacy deadlines only when pre-existing values may need review. Recovery lasts 30 days, without promising an exact physical deletion time.

Further production access requires explicit approval of the target, actions, and effects. Read-only approval does not authorize manual cleanup, migrations, configuration changes, or deployment; approve those separately. Manual cleanup permanently deletes eligible notes across owners.

## Verification evidence

**Production, 2026-10-24 — `https://noteverse.vercel.app`:**

- Owner confirms deployment, migration, production secret setup, and create/trash/preview/restore.
- Owner-triggered Vercel Run returned HTTP 200: `Note cleanup { ok: true, deleted: 0, batches: 1, bounded: false }`, corroborated by the dashboard screenshot.
- Two explicitly approved unauthenticated requests returned GET 401 (`Unauthorized`) and HEAD 405 (`Allow: GET`), both with `Cache-Control: private, no-store`. Automatic invocation remains pending.

**Local, 2026-10-23–24:**

- Lint/type checks, build/service-worker generation, 24 regression tests, authenticated app HTTP checks, and isolated built-production cleanup HTTP checks pass. Coverage includes ownership/state denial, atomic drafts, deadline boundaries, stale tokens, races, bounded cleanup, locked rows, rollback, retries, and 500-row/1-row/zero-row cleanup runs.
- Browser checks cover EN/VI lifecycle flows and failures, keyboard/focus behavior, live expiry including offline body/control removal, service-worker cache removal, offline read/mutation rejection, and reconnect. Final UI review passes after correcting a shrinking preview back-arrow; EN covers 1440/768/390 and four appearances in light/dark at 1440/390; VI final review covers Bookish/dark at all three widths.
- Temporary routes, scripts, and QA notes were removed; the final local audit returned to **4 notes, zero deadlines**. Physical iOS safe-area behavior and the full Vietnamese appearance matrix remain unverified. A prior EN→VI client-navigation script-rendering warning has unverified origin/production reproduction; direct VI loading passed.

## Local checks

`NOTES_TEST_DATABASE_URL` is optional test configuration, unnecessary on Vercel or for normal dev/build. Use an existing disposable loopback database whose name contains `_test`; never the app or production database. Run regression and cleanup HTTP suites separately because cleanup sweeps expired test rows. Cleanup HTTP checks require a build and free port 3002; app HTTP checks require the dev server and existing QA user described in [AGENTS.md](../AGENTS.md).

```powershell
$env:NOTES_TEST_DATABASE_URL = 'postgresql://USER:PASSWORD@localhost:5432/note_recovery_test'
pnpm test:notes
pnpm build
pnpm test:notes:cleanup:http
$env:NOTES_TEST_ORIGIN = 'http://localhost:3000'
pnpm exec dotenv -e .env.local -- pnpm test:notes:http
pnpm exec dotenv -e .env.local -- pnpm db:audit:notes
pnpm lint
```

Repeated `(.)` prefixes in dev modal IDs indicate accumulated hot-reload rewrites: restart the dev server, never weaken ID validation. Follow AGENTS.md for build permissions and QA provisioning.
