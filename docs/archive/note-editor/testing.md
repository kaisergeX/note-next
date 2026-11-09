# Note editor verification

Recorded completion results and release limits are in the [overview](overview.md). Run checks proportionate to changes; preserve the safety contracts in [architecture](architecture.md).

## Local checks

```sh
pnpm test:notes:sync
pnpm test:account
node --import tsx --test scripts/note-editor-commands.test.ts
node --import tsx --test scripts/note-html.test.ts
pnpm lint
pnpm build
```

The sync suite covers reconciliation, retry identity, generations, queue budgets, and bounded text diff. Account tests use .env.local and create/drop their own disposable database on local PostgreSQL; they do not migrate or delete fixtures in the app database. HR tests cover paragraph-end, existing following paragraph, heading, quote, adjacent HR, middle, and empty cases. Turbopack builds need elevated execution in restricted environments for worker port binding/font access.

Empty-draft regressions in `scripts/note-save-queue.test.ts` cover:

- Untouched and color-only new drafts perform no local writes, cleanup, or server requests.
- Clearing a never-submitted draft removes its earlier checkpoint, waits for pending local writes, preserves newer typing during cleanup, and permits retry after cleanup failure.
- Retry and Close replay an ambiguous creation with its original identity before saving the latest empty content against the acknowledged note ID.

These controller tests use injected in-memory persistence and transport dependencies; they do not establish real IndexedDB or database/browser integration behavior.

## Browser suite

Use an already migrated local PostgreSQL database. The app and runner must share DATABASE_URL and the auth secret; the runner loads .env.local. NOTES_TEST_ORIGIN must be loopback HTTP, and DATABASE_URL must be loopback PostgreSQL.

```sh
pnpm exec playwright install chromium
pnpm dev
```

In another terminal:

```sh
NOTES_TEST_ORIGIN=http://localhost:3000 pnpm test:notes:browser
# Optional stability run with fresh fixtures:
NOTES_TEST_ORIGIN=http://localhost:3000 pnpm test:notes:browser --repeat-each=2
```

The suite does not start a server or apply migrations. For production-preview verification, finish `pnpm build` first, then start:

```sh
AUTH_URL=http://localhost:3002 NEXTAUTH_URL=http://localhost:3002 pnpm start --port 3002
```

Run the suite with NOTES_TEST_ORIGIN=http://localhost:3002. Matching auth origins keep logout redirects in the same browser-storage context. Stop temporary servers afterward.

### Coverage

| Browser spec                    | Main regressions                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| note-read-mode                 | Mobile/desktop defaults, read-only title/body, selection-to-edit, no saves from reading, autosave after switching, undo/editor identity, modal navigation, new mobile notes |
| note-recovery                   | Failed-sync reopening, durable URLs, RSC/editor identity, guarded decisions, lost-response retries, competing versions                                   |
| note-card-colors / note-close   | Authored card fills, one-card identity, close during committed/in-flight creation                                                                        |
| note-html-safety                | Unsafe saved/recovery title/body HTML cannot execute in cards; formatting survives and source HTML is not rewritten                                      |
| note-account-lifecycle          | Account-exit choices, real sign-out, expired sessions, live account switching and recovery retention                                                     |
| note-browser-work               | Return context, reload, chooser dismissal, saved/browser choices, cached editor reopening                                                                |
| note-edit-copy / note-workspace | Source retention, copy reuse/discard, stale resolution, reload, undo/editor identity, diff tabs, independent long-pane scrolling, worker history handoff |

Specs live in [scripts/browser](../../../scripts/browser); fixture behavior lives in [fixtures.ts](../../../scripts/browser/fixtures.ts). Each test creates unique accounts and fresh contexts, verifies server identity before mutations, and cleans up only its own accounts/notes after closing controllers. No existing QA account, OAuth login, or feature grant is required. Real authenticated sync HTTP and UI editing are used; interception supplies failures, stale writes, and lost responses.

## Reading mode closeout

On 2026-11-09, after the final icon and spacing design was accepted, lint/type checks, the production/Serwist build, formatting, and all seven focused browser checks passed against the local development app. Repeat the browser checks with:

```sh
NOTES_TEST_ORIGIN=http://localhost:3000 pnpm test:notes:browser scripts/browser/note-read-mode.spec.ts scripts/browser/note-pagination.spec.ts scripts/browser/note-workspace.spec.ts --grep 'reading mode|new mobile note|returning from an older|closing and reopening comparison'
```

This covers four reading-mode cases, desktop/mobile pagination return, and mobile comparison (seven checks). Existing mobile editing tests now explicitly choose Edit before changing a saved note. The broader search suite requires an isolated database whose name includes `_test`; do not bypass that guard or run its migration setup against the interactive app database.

Final independent visual review passed at 390×844 and 1440×1000: modal/full-page controls are circular 40×40px ghost buttons with 24px icons and an 8px gap; mobile controls remain available without horizontal overflow. Localized tooltips and accessible names were checked, no console warnings or errors were observed, and the review browser was closed. The earlier reading-mode review also covered English/Vietnamese and Paper & Ink light/dark.

Native phone keyboard and IME behavior still need a physical-device check. Browser emulation verifies `contenteditable=false`, selection, and focus, but does not establish virtual-keyboard behavior.

## Avoid misleading regressions

- Fixture sign-in verifies the intended account through the real session endpoint and reinstalls its signed cookie if an old response rotated it back. Deliberately expired cookies skip this read so the tested mutation receives them. Live-switch response matching must identify the new account.
- Wait for destination routes before targeting cached chooser controls. Hover over stable panes before wheel input; raw coordinates captured during animation can miss the pane. Keep actual wheel, reachability, independent-scroll, focus, and undo assertions.
- Assert durable version queries and word-diff spans according to their semantics; words may occupy separate spans.
- RSC refresh uses note-list-stale and checks the rendered result/editor identity; development streams may remain open, so do not wait for stream closure.
- One worker and zero retries are intentional. Failure screenshots/traces live in .playwright-mcp/note-regressions/ (git-ignored); inspect with `pnpm exec playwright show-trace <trace.zip>`.

Service workers are blocked except in the explicit worker handoff case. The suite does not establish offline launch, general PWA hydration, Google OAuth interaction, physical-device IME, or an exhaustive browser/locale/appearance matrix. For UI changes, follow the repo's ui-build review requirements, use disposable fixtures, preserve unrelated work/preferences, close the review browser, and stop temporary servers.
