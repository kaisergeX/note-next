# Integrated note recovery handoff — 2026-10-29

The owner accepted the visual design and authorized verification on 2026-10-29. They subsequently requested removal of the Notes toolbar's bottom border; that change is included. **Independent UI review is still pending.** The reviewer could not open its Chrome profile because it was locked, so review stopped under AGENTS.md without inspecting any UI states. The owner will start a new thread for UI review.

Read this file, [recovery-ux.md](recovery-ux.md), [overview.md](overview.md), [autosave.md](autosave.md), and [conflicts.md](conflicts.md). Inspect the current working-tree diff. Everything remains uncommitted. No deployment or production migration was performed or authorized.

## Accepted UI and implementation

- Notes joins account-scoped browser work and saved notes by note/creation identity. One equivalent local group supplies the card title/body/color and resumes automatically. Distinct versions stay within one note's Review chooser. Never select the correct version by checkpoint time or delete records merely because cards are grouped.
- Browser-only creations use their stable creation ID as the collection key. Local save acknowledgements update mounted previews without refreshing the server collection on every save; fresh server props replace that overlay. Card identity/order stays stable across checkpoints and server identity acquisition.
- `/collection/drafts` redirects to `/eton#browser-work`; account-exit Review goes to Notes. Trash remains separate. The old unmounted `recovery-drafts.tsx` and `device-drafts-link.tsx` files still exist; they are not active destinations. Do not mistake them for the delivered UI.
- Filters appear only when there are both ordinary notes and a distinct Needs review subset. Otherwise show all work without filter controls. Unavailable originals stay in the same list with a short warning and explicit Save as new note. No trailing recovery section below the growing list.
- Collection management stays at the far left; the expanding Create button stays alone at the far right. The toolbar has **no bottom border**. Preserve Create's accepted hover treatment and avoid moving neighboring controls during expansion.
- The saved-note three-dot trigger/menu use their original small/intrinsic sizing. Saved-note menus contain note-level actions. Local version management sits beside its version in Review, or on a browser-only card. A single scope heading (This version / All local changes) precedes Export and Discard. No ellipses or repeated scope in every row. Discard confirmation remains explicit and snapshot guarded.
- `MenuCustom` uses its existing custom-content slot for titled groups; it has no dedicated group/title prop. `MenuItemButton` inherits the shared Button radius rather than forcing square corners. Recovery menus have no added outer padding. The owner accepted this state; do not reopen the radius discussion.
- Desktop Review uses a bounded two-pane comparison: saved note beside one selected local version. A dated selector identifies local checkpoints; a neutral suffix only disambiguates identical formatted times. Per-pane account/date description lines were removed. Full rich previews scroll independently and retain authored colors. Mobile stacks bounded previews. Existing guarded server/local conflict comparison remains separate.
- Footer recovery actions occupy the full-width row above the normal color/status/menu controls. Comparison controls have space around the clipping boundary so the three-dot focus ring remains visible. Nested Escape closes the active popover/confirmation before its parent.
- `useMasonry<T extends HTMLElement>` lives in `util/hooks/use-masonry.ts` and is exported with shared hooks. It has no note/account dependencies. It reads CSS grid tracks, measures children, and places them in source order at the next open column when native CSS masonry is unsupported. ResizeObserver/frame/style cleanup is encapsulated in the hook. Notes supplies a visible-membership key and attaches its returned ref. Do not replace it with CSS dense placement or column ordering that changes keyboard/reading order.
- Keep blank titles blank, authored colors, EN/VI, storage failure guidance, account-exit retention/discard, concurrency baselines, retry IDs, and generation/ownership checks. Existing uncommitted Trash blank-title and preview fixes are retained.

## Persistence work verified in this iteration

- Equivalent source copies retire only after durable handoff, using the captured pre-handoff snapshot; later/newer copies survive. Old source controllers stop/drain so they cannot recreate retired copies. Same-route version choices get a fresh session identity.
- Shared `noteRecoveryGroups` matches owner plus note/creation identity. This includes a creation request that committed while its response was lost; acquiring a known server ID preserves the exact pending creation retry.
- After draining a source controller, handoff still compares its generation/time against the supplied recovery record; it does not blindly substitute older memory for newer storage.
- Local discard checks live same-page state before stopping captured controllers, then uses the existing account/generation-checked storage transaction. Browser reads reject stale out-of-order results.
- Temporary Use saved read failures do not imply deletion. Only a confirmed 404 marks the original unavailable; 401 stays actionable as authentication failure. Version switching/navigation additionally checks that the latest generation is locally safe after checkpointing.
- React lint fixes moved collection ordering from render-time ref mutation to guarded derived state. Filter reset no longer uses a synchronous setState effect. Accepted appearance/behavior remains the same.

## Completed verification — 2026-10-29

| Check | Result |
| --- | --- |
| Queue, reconciliation, recovery grouping, and mutation/service-worker policy suites | **39/39 passed** via `node --conditions=react-server --import tsx --test scripts/note-sync.test.ts scripts/note-save-queue.test.ts scripts/note-mutation.test.ts`. |
| Authenticated sync HTTP suite | **1/1 passed** with loopback `NOTES_TEST_ORIGIN=http://localhost:3000`, `.env.local`, and `scripts/note-autosave-http.test.ts`. Its temporary users/notes were cleaned in the suite's finally block. |
| `pnpm lint` | **Passed**, including TypeScript and ESLint. The first run found collection ref/effect issues; they were fixed before the passing run. |
| Elevated `pnpm build` | **Passed**, including TypeScript, all 110 pages, and Serwist generation. |
| Build warnings | Existing Google Sans fallback-font metrics warning and experimental Node localStorage warnings remain. |
| Independent UI review | **Not performed.** Chrome review profile was locked; reviewer returned NEEDS URL and inspected no states. Do not report a PASS or count historical reviews as current evidence. |

The initial 31-test pass preceded eight added cases; the current combined result is 39. Added cases cover ambiguous selection without timestamp choice, logical creation/account matching, exact creation retry retention, copies arriving during handoff, same-route controller replacement, and Use saved HTTP 503/401/404 behavior. The earlier explicit-resumption/theme/checkpoint/concurrency tests are retained and now executed.

### Parent browser evidence

- Blocking only `/api/note/sync`: new note title/body/purple theme remained on one Notes card; reopening continued that work. After successful retry and the queued newer save, one saved purple card remained with a normal note URL. The first acknowledgement legitimately had the earlier submitted theme; the later queued save retained the newer purple theme.
- Editing that owned saved QA note with sync blocked: changed title/body/green theme appeared on one card and resumed automatically in its normal dialog, without a recovery confirmation or comparison dialog.
- Adding a distinct local candidate while editing exposed Review other versions without opening a dialog. Closing/reopening produced one logical card and the version chooser. Opening the saved version retained both green/blue local alternatives and kept Review available.
- Direct full-page loading of that ambiguous saved note rendered the chooser.
- An isolated browser context with IndexedDB open failure showed recovery-storage guidance on Notes and full note entry. Ordinary editing was blocked (zero editable surfaces) and Retry stayed available; it did not look like an empty recovery collection.
- Expected browser console network errors came from deliberate `/api/note/sync` blocking. These checks do not replace independent visual/accessibility review or exhaustive physical-device testing.

## Next thread: review and remaining boundaries

1. Keep the accepted product/design direction. Confirm the dev server at `http://localhost:3000` is running; start it if needed. SWC's native cache required elevated dev execution on this machine. Do not change configuration to evade sandbox restrictions.
2. Release the locked Chrome automation profile before review. Do not force-unlock, kill an unrelated browser, or retry through a workaround. If it is locked again, inform the owner and stop as AGENTS.md requires.
3. Run one scoped `ui_reviewer` at a time under the ui-build skill/rubric. Coverage: Notes, conditional filters and standalone Create hover, mixed-height layout/keyboard order, shared menus, blank titles/colors, local-version chooser, editor footer, unavailable/storage guidance, account-exit Review, legacy Drafts redirect, and representative Trash. Use EN/VI, desktop 1440x1000/mobile 390x844, light/dark in an existing appearance plus one contrasting font preset where practical. No all-appearance redesign audit is needed.
4. Before final completion, explicitly check the boundaries below. They were noticed during source audit but **not reproduced or fixed before the profile-lock stop**:
   - **Recovery URL reload after handoff:** a resumed `/full/eton/recover/[oldDraftId]` can remain in the address bar after its source record retires (observed during the parent creation flow). `NoteRecoveryPage` still looks up that exact ID. Verify reload before/after server acknowledgement and fix stale-route continuation if needed, preserving editor instances and all work.
   - **Repeated hydration of an already-open recovery session:** `useNoteSession` calls `beginNoteSync` with the recovery object when its effect runs again, while explicit same-key choices intentionally create a fresh controller. Check prop/RSC refreshes and modal/full handoffs so an incidental rerun cannot restore a stale supplied record over current edits. This is a source-audit concern, not a passing regression claim.
   - Complete controller-aware discard race coverage against browser storage, direct recovery Open saved behavior, mobile/reload/cross-tab navigation, unavailable-original Save as new note, and account-exit/auth-expiry behavior as needed. Existing queue/HTTP results do not establish every UI boundary.
5. Fix confirmed findings within scope, rerun relevant checks when source changes, and follow the rubric's focused re-review/max-two-round rules. Record measured verdict/limits before declaring completion.
6. Clean the owned fixtures below after they are no longer needed. Do not clean up pre-existing QA notes or unrelated working-tree changes. No commit, deployment, or production migration unless requested.

## Test data and local artifacts still present

**Cleanup was not completed after the browser-profile-lock stop.** Earlier screenshot-only fixtures were cleaned; this final verification run has a different, still-present fixture set:

- Owned temporary server note: `0f90aef9-be79-45e1-b6c7-27cc297b4e64`, title `Integrated recovery QA 20261029`, account `qa@test.dev` / owner `01a145be-fdc9-72cb-00e3-06a2513fe445`. It was created by the parent via the app during this verification. Preserve it for review until cleanup.
- Parent browser storage contained two alternatives for that note at last inspection: `47b0d6af-b0a3-4400-96ee-be8341a28db3` (green) and `fa100000-0000-4000-8000-000000000001` (blue). Later generations/IDs must be checked before cleanup. The QA tab may still block `**/api/note/sync`; restore request handling after securing/stopping fixture controllers. Never discard local work belonging to another note/account.
- Ignored `.playwright-mcp/integrated-recovery-review.json`: four **prepared but not seeded by the failed reviewer** browser-only fixtures (competing versions for the owned note, a new local note, and an unavailable original). IDs start `f9200000-`; review source has the owned note ID. No credentials are stored in this JSON.
- Ignored `.playwright-mcp/integrated-recovery-fixtures.mts`: loopback-only helper. `node --env-file=.env.local --import tsx .playwright-mcp/integrated-recovery-fixtures.mts` regenerates the review JSON using a guarded read of the owned QA note. Adding `cleanup` deletes only that title/owner/ID-checked server fixture and its creation key; it does **not** clear browser recovery. Review the helper before running it, and only use the intended local database. Do not run cleanup before review needs the saved note.
- Existing QA notes titled Phase 0 upgrade QA / QA Round 2 Note were not edited by this verification. Do not delete or modify them as fixture cleanup.
- Earlier ignored screenshots use `notes-recovery-*`, `recovery-revised-*`, `recovery-spacing-*`, `recovery-dated-versions*`, `recovery-rounded-menu*`, and `recovery-grouped-*`. They are historical presentation captures, not the blocked independent review's evidence.

### Reviewer setup

Use a separate disposable browser/context rather than mutating the parent's active QA work. Sign in as the existing `qa@test.dev` using the development Credentials provider: obtain `/api/auth/csrf`, then same-origin form POST to `/api/auth/callback/credentials` with `csrfToken`, `email=qa@test.dev`, and a localhost callback URL. See AGENTS.md. If the QA account is missing, ask the owner to provision it; never create feature grants or accounts yourself.

Block `/api/note/sync` in that isolated review context before opening fixture editors. Load Notes once to let Dexie initialize `etoN-note-recovery`, then seed only the prepared review JSON's records into that context's `drafts` store and dispatch `note-recovery-changed`. This is throwaway browser setup, not permission to change saved server notes. Do not submit destructive confirmations during visual review. Close only the reviewer's isolated context, restore changed preferences, and retain a precise coverage report.

## Earlier context

Previous recovery patches fixed stale authored colors, grouped equivalent copies, and added generation-safe source retirement/controller draining. They were evaluated and retained rather than replaced wholesale. Prior Phases 0–2 and minimum conflict safety had historical owner acceptance; those older checks do not certify this integration. Autosave migration `drizzle/20261027120859_note_autosave` remains locally applied only.
