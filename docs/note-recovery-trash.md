# Note Recovery and Trash

**Status:** Phases 1–4 implemented and locally verified through 2026-10-24, including final UI review. The owner confirmed the production migration and production `CRON_SECRET` configuration are complete (2026-10-24). Production deployment/scheduler verification remains open and requires separate approval before any production access.

## Behavior

- Move saved notes to Trash for **30 days**, without confirmation. Editor deletion atomically saves the current title/body/theme; close on success without saving again. Retain drafts on failure.
- Trash shows newest first, with title/excerpt, expiry, read-only preview, Restore, and confirmed Delete permanently.
- Restore preserves content, theme, flags, ID, and creation date; return to Notes without opening an editor.
- Ordinary, modal, full, and API reads cannot expose trashed, expired, missing, or foreign-owned notes.
- Provide EN/VI text, pending/error/empty states, and collection navigation for All notes / Recently deleted: a desktop sidebar and mobile selector, including empty states. Follow [DESIGN.md](../DESIGN.md).

Excluded: bulk actions/Empty Trash, search, configurable retention, version history, archive management, offline mutation queues, account deletion, and recovery of previously hard-deleted notes.

## Data contract

Reuse `pendingDeleteAt` as the permanent-deletion **deadline**, independent of `isArchived`.

| State       | Predicate                | Operations                            |
| ----------- | ------------------------ | ------------------------------------- |
| Active      | Deadline is null         | Normal read/edit, trash               |
| Recoverable | Deadline > database time | Trash read, restore, permanent delete |
| Expired     | Deadline ≤ database time | Cleanup only                          |

- Derive ownership from `requireAuth().userInfo.id`; validate IDs and filter every operation by owner/state. Generic edits allow only title/content/theme.
- Use conditional writes and inspect affected rows. Repeated trash cannot extend retention or overwrite its first draft. Metadata survives; the existing trigger may advance `updatedAt`.
- Retention is exactly **2,592,000 elapsed seconds**, using the database clock. Recovery ends at expiry even if cleanup is delayed.
- Restore/delete require the unchanged **`deadlineToken`** (UTC ISO, six fractional digits). JavaScript `Date` loses precision. Reject stale-cycle tokens.
- Outcomes: `success`, `already_applied`, `unavailable`, `conflict`, `invalid_input`, `retryable_error`. Never disclose foreign rows or infer unrecorded completion. General content versioning is excluded.

## Phase 1 delivered

[Repository](../db/repositories/notes.ts), [actions](<../app/[locale]/(note)/eton/actions.ts>), and [validation](../lib/notes/validation.ts) enforce the contract. Lifecycle helpers remain internal. Note reads are fresh; successful actions invalidate owner-scoped active/trash/detail tags. API responses use `private, no-store`. Existing editors retain failed drafts and provide localized errors, accessible fields, and locale-aware navigation.

The [index migration](../drizzle/20261023052245_note_recovery_indexes/migration.sql) passes in the disposable database. The 2026-10-23 read-only local app audit confirms **4 notes, zero deadlines**, both recovery indexes, and the update timestamp trigger. The owner confirmed the production migration is complete (2026-10-24). The production legacy-deadline audit remains unverified.

## Phases 2–3 delivered

- Authenticated lifecycle actions replace active-note hard deletion in cards and both editors. Trashing snapshots the latest draft; failure keeps it open, success leaves without another save.
- `/trash` and `/trash/[id]` provide owner-scoped lists, safe read-only previews, restore, and named permanent-delete confirmation outside the modal layout.
- EN/VI navigation, empty/pending/error/offline states, note hues, accessible dialogs, and local expiry display are included. Focus, visibility, reconnect, and nearest-deadline events refresh eligibility using database time.
- The service worker excludes note HTML/RSC/API reads and mutations from caching, removes legacy cached note responses, and filters unresolved route templates from precaching. No note bodies enter the appearance store.

## Phase 4 delivered: cleanup

- [Vercel scheduler](../vercel.json): daily `GET /api/cron/note-cleanup`, scheduled for 03:00 UTC (10:00 Asia/Saigon). The schedule becomes active on production deployment; configuration alone does not prove it is running. See [Vercel cron documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
- [Endpoint](../app/api/cron/note-cleanup/route.ts) and [runner](../lib/notes/cleanup.ts): server-only `CRON_SECRET` Bearer authentication, constant-time digest comparison, fail closed when unconfigured, reject HEAD/other methods, and private/no-store responses. Logs and responses contain counts/status only.
- [Repository](../db/repositories/note-cleanup.ts): up to five batches of 100 rows per invocation, with a 20-second budget checked between batches, 5-second statement and 500ms lock timeouts. Select due deadlines using database time, lock with `SKIP LOCKED`, recheck eligibility on deletion, and return identities only. Owner list/trash/detail invalidation runs before each batch commits; failure rolls back that batch. Retries and concurrent workers are safe.
- The service worker excludes cleanup from runtime caching and precaching. Existing EN/VI copy says to recover within 30 days, without claiming an exact physical deletion time.

## Remaining rollout and final checks

- [x] Implement the approved Trash list and preview changes: revised empty-state copy, no repeated In Trash label, and one preview back-arrow. The list returns to Notes through the collection navigation, without a separate back-arrow or Back to Notes button.
- [x] Implement the approved collection navigation in the real views: All notes / Recently deleted in a desktop sidebar and mobile collection selector, with a subtle tinted current-page state. Desktop user-menu and mobile-menu Trash links remain removed.
- [x] Complete final local lint/type checks, build, appropriate tests, and UI review. The owner authorized this final pass on 2026-10-24; results are recorded below.
- [x] Apply the production recovery index migration. Owner confirmed complete on 2026-10-24.
- [x] Configure production `CRON_SECRET` in the Vercel project. Owner confirmed complete on 2026-10-24; the secret is not recorded here.
- [ ] After approval of a read-only production check, audit the intended database with `db:audit:notes` and review any legacy deadlines **before enabling cleanup**, since all already-due rows will be eligible. The owner may instead supply the audit evidence.
- [ ] Confirm the deployed revision, production secret availability, cron configuration, and existing invocation logs through an approved read-only check or owner-provided evidence.
- [ ] Verify production unauthenticated GET returns 401 and HEAD returns 405 as part of that approved check. Separately approve any authorized cleanup invocation: it permanently deletes expired notes across owners, up to 500 per run. Verify a scheduled invocation and record deployment/invocation evidence before claiming automatic deletion.
- [ ] Monitor failures and `bounded: true` results. One invocation removes at most 500 rows; repeated full batches may indicate a backlog. After reviewing counts, rerun through the dashboard until drained, or adjust capacity deliberately. `bounded: false` may still leave rows locked by another transaction; the next run revisits them. Vercel does not automatically retry failed cron invocations; inspect failures and rerun after resolving them.
- [x] Finish the previously outstanding browser checks: keyboard traversal, extra appearance presets, and live expiry timing. See the acceptance evidence below.
- [x] Remove the temporary navigation preview route after implementing the approved navigation.
- [ ] Archive this plan and mark the README roadmap complete after final checks and production cleanup verification.

### Production setup and verification

Before any production access, explain the exact target, operations, and effects and obtain explicit approval. Read-only checks do not authorize migrations, environment changes, deployment, or manual cleanup; propose and approve those separately. The owner has already reported the migration and secret setup complete, so the setup commands below are reference instructions, not outstanding actions to repeat.

From PowerShell, with `.env.production` pointing to the intended deployment database. Set both `DATABASE_URL` (used by the audit/app) and `POSTGRES_URL_NON_POOLING` (used by Drizzle migrations) to the same production database, using its appropriate pooled/direct connections:

```powershell
pnpm exec dotenv -e .env.production -- pnpm db:audit:notes
# Review due/legacy deadlines before enabling the cleanup job.
pnpm db:prod:migrate
# Generate locally; paste the result into Vercel, never into source control.
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

In the Vercel project, add `CRON_SECRET` under **Settings → Environment Variables**, scoped to **Production**, using the generated value. Deploy the revision containing `vercel.json` after setting the variable; changing a variable does not update an existing deployment.

Check the production endpoint without credentials (replace the example hostname):

```powershell
curl.exe -i https://YOUR-PRODUCTION-DOMAIN/api/cron/note-cleanup
# Expected: 401 (503 means CRON_SECRET is missing from this deployment).
curl.exe -I https://YOUR-PRODUCTION-DOMAIN/api/cron/note-cleanup
# Expected: 405; HEAD must never delete notes.
```

Open the project's **Settings → Cron Jobs**, confirm `/api/cron/note-cleanup` exists, and use **Run**, then **View Logs**. This is a real cleanup of already-expired notes. Expect HTTP 200 and `Note cleanup` with `ok: true` and counts; zero deletions is valid. A 500 means inspect the failure and rerun after resolving it. A `bounded: true` run may require another invocation to finish the backlog.

Then verify a scheduled invocation in those logs and record its timestamp and deployment here. The expression targets 10:00 Asia/Saigon daily; on Vercel Hobby, invocation may occur anywhere from 10:00 to 10:59. Manual success proves the endpoint works, while the later scheduled invocation proves scheduling is active. See [cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [environment variables](https://vercel.com/docs/environment-variables), and [Hobby timing limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## Verification

### Final local verification (2026-10-24)

- Lint/type checks pass without warnings, the production build and service-worker generation pass, and all 24 regression tests plus the isolated cleanup HTTP test and authenticated local app HTTP test pass. The cleanup HTTP test uses only the disposable loopback `_test` database; it is not evidence of a live production invocation.
- UI review passes after one targeted correction: the Trash preview back-arrow now retains its 40×40px size beside a wrapping title. EN Notes/list/preview were checked at 1440/768/390 and across four appearances in light/dark at 1440/390; VI Bookish/dark was checked at all three widths. The focused re-review confirmed the correction in both locales without repeating the appearance matrix.
- Mobile New Note remains fixed while scrolling, with its bottom safe-area offset restored and no minimum-size override. Desktop creation remains in the header. Collection keyboard navigation, visible focus, confirmation cancellation, and focus return pass. No horizontal overflow, label/alt, heading-order, or settled contrast failures were found in the reviewed views.
- Both temporary local UI review notes were removed. The final local audit returned to **4 notes, zero deadlines**. EN/VI empty Trash copy was checked afterward without horizontal overflow. The temporary navigation preview route was removed.
- Physical iOS safe-area behavior and the full Vietnamese appearance matrix were not checked. Production invocation evidence remains separate from these local results.

### Earlier verification (2026-10-23)

**Phase 4 verification (2026-10-23): 24 regression tests, 1 isolated production cleanup HTTP test, lint, build, and formatting pass.** Coverage adds authentication/method denial, bounded work, partial failures, multi-owner deletion, active/restored/future survival, delayed cleanup, overlapping workers, locked-row eligibility changes, invalidation rollback, and idempotent retries. Cleanup tests migrate and sweep only a disposable loopback `_test` database. The HTTP test starts its own built production server with a temporary secret and verifies real 500-row/1-row/zero-row cleanup runs. Local lint initially found stale `.next/dev/types` from before Trash existed; starting the dev server refreshed generated route types.

Earlier phases also passed the authenticated note-read HTTP test. A production-worker browser check verified installation, selective legacy-cache removal, offline note read/mutation rejection, and reconnect. UI review passed EN/VI, 390/768/1440, light/dark, atomic modal draft/theme trash (one request), full-editor failure/retry, read-only preview, restore, and confirmed permanent-delete failure/retry.

### Browser acceptance follow-up (2026-10-23)

- All four appearance presets (Paper & Ink, Sepia, Midnight, Bookish), light/dark, passed Trash list and preview checks at 1440/390; Paper & Ink light also passed at 768. Measured overflow, text contrast, heading order, image alternatives, and field labels passed. The account's original Bookish/light preference was restored and verified.
- Keyboard traversal reached all 14 list controls with visible focus; Enter opened preview. EN/VI permanent-delete dialogs focused Cancel/Hủy initially, exposed confirmation through Tab, supported keyboard cancellation and Escape, and returned focus to the trigger. Mobile keyboard navigation reached Trash. Review found and fixed undersized header language/theme controls (now 40×40px on mobile), missing menu arrow navigation, and inconsistent brand/mobile Trash link focus outlines. Disclosure menus retain normal link/Tab semantics and additionally support Up/Down, Home/End, and typeahead.
- Real database deadlines set 25 seconds ahead verified automatic list removal and open-preview denial without manual reload. Offline VI preview removed its body and recovery controls at expiry, displayed localized guidance, and returned 404 on reconnect; the note API also returned 404. SQL confirmed expired fixtures remained physically present before cleanup, proving access ends independently of the scheduler.
- Temporary QA notes and their helper script were removed; the final read-only local audit returned to **4 notes, zero deadlines**. No existing note was edited or removed. The follow-up did not repeat the full Vietnamese preset matrix or earlier restore/permanent-delete execution checks; those flows retain their earlier verification evidence.
- Focused re-review **PASS**: EN/VI language menus and desktop user menus passed arrow opening, wraparound, Home/End, typeahead, and Escape focus return; language Tab/Shift+Tab still works. Both mobile controls measured 40×40px, with 2px focus outlines/offsets on brand and mobile Trash links. One nonblocking development diagnostic remains for separate investigation: client EN→VI navigation logs React's script-rendering warning, while navigation succeeds and a direct VI load has zero errors. Its origin and production reproduction are unverified.

```sh
# Dedicated loopback DB with _test in its name; never the app DB
NOTES_TEST_DATABASE_URL='postgresql://USER:PASSWORD@localhost:5432/note_recovery_test' pnpm test:notes
# After pnpm build, with port 3002 free; starts/stops its own production server
# Run separately from test:notes because cleanup sweeps all expired test rows
NOTES_TEST_DATABASE_URL='postgresql://USER:PASSWORD@localhost:5432/note_recovery_test' pnpm test:notes:cleanup:http
# Running dev app and existing qa@test.dev; cleans its own fixture
NOTES_TEST_ORIGIN=http://localhost:3000 pnpm exec dotenv -e .env.local -- pnpm test:notes:http
# Read-only audit of the chosen environment
pnpm exec dotenv -e .env.local -- pnpm db:audit:notes
pnpm lint
pnpm build
```

Follow AGENTS.md for build permissions and QA provisioning. Repeated `(.)` prefixes in dev modal IDs indicate accumulated hot-reload rewrites: restart the server, never weaken ID validation. Archive this plan after the feature and deployed cleanup are complete.
