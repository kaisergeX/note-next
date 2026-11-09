# Note editor and persistence

Phases 0–3, including Edit a copy, are complete locally and owner-accepted as of 2026-11-05. On 2026-11-06, the owner confirmed deployment and reported that the feature appears to work in production. This folder is the maintenance reference for the completed feature.

- [Architecture](architecture.md): ownership, persistence, recovery, conflict resolution, and invariants to preserve.
- [Testing](testing.md): repeatable checks and browser-fixture requirements.
- Shared contracts: [design system](../../../DESIGN.md), [Trash lifecycle](../../note-recovery-trash.md), [account actions](../account-data-actions.md), and [bulk Trash](../trash-bulk-actions.md).

## Delivered and verified

The feature includes rich-text titles/bodies, stable editor sessions and formatting, bounded autosave, account-scoped browser recovery integrated into Notes, version selection, guarded conflict decisions, text comparison, and editable Working copies with retained sources.

Verification on 2026-11-05:

| Check                                   | Result                                                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused sync, queue, and diff           | 60/60 passed, including seven empty-draft audit regression cases                                                                                     |
| Isolated database/account regressions   | 43/43 passed                                                                                                                                        |
| Production-preview browser suite        | 37/37 passed; one worker, zero retries                                                                                                              |
| Lint/types and production/Serwist build | Passed                                                                                                                                              |
| Independent UI review                   | Passed: modal/full views, version selection, Working copy, scrolling, keyboard/focus; scoped EN/VI, desktop/mobile, Paper & Ink and Bookish samples |

The follow-up audit fixed stale browser checkpoints after clearing never-submitted drafts and blocked creation retries after clearing a draft with a lost response. The fixes preserve newer edits during cleanup and exact retry identities. The 60-test sync suite, lint/types, and diff checks passed after these fixes; database/account, browser, production/Serwist build, and UI-review results above predate them and were not rerun. Regression details are in [Testing](testing.md#local-checks).

## Reading mode

Implemented and owner-accepted on 2026-11-09. Saved notes open in reading mode on phones (below 40rem). Desktop notes, new notes, and conflict Working copies start editable. Removing autofocus alone would still let a tap activate editing, so reading explicitly makes the title and body read-only while keeping text selectable and copyable.

The modal and full-page toolbar share an icon-only mode action: a pencil enters Edit; a book enters Read. It uses the same circular ghost button and icon size as fullscreen, with the two actions grouped using `gap-2`. Localized tooltips and accessible names identify the next action in English and Vietnamese. Reading hides formatting tools; navigation remains available.

Edit resumes at the selected passage, or the last active field when there is no selection. Mode switches reuse the same editor, document, selection, and undo history. Switching modes does not itself change content or trigger a save; existing autosave continues for edits made before entering Read. Mode choice belongs to the current workspace; reopening uses the device default again. Resizing a mounted workspace does not override the chosen mode.

Verification and remaining device limits are recorded in [Testing](testing.md#reading-mode-closeout).

## Production status and verification limits

Deployment and initial production behavior are owner-reported; no independent production verification was performed for this update. On 2026-11-07, the owner confirmed that the production migration `drizzle/20261027120859_note_autosave` is complete. The target is Vercel Hobby with Neon Free for roughly 10–20 active users; measure actual traffic and database amplification before optimizing.

Stored HTML rendering remains an explicit [security boundary](architecture.md#security-and-future-boundaries); the local assessment and fix are recorded below. A worker-enabled run emitted React hydration error 418; general PWA hydration is not cleared by the persistence suite. Physical-device/IME, actual fullscreen, exhaustive locale/appearance/engine coverage, and production performance remain unverified. Automatic Trash cleanup remains pending and was left untouched at the owner's request; see the [Trash closeout](../../note-recovery-trash.md#pending-closeout).

## HTML safety review (2026-11-07)

**Finding and fix:** saved title/body strings and browser recovery copies could reach NoteCardSummary's raw HTML sinks without sanitization. A crafted authenticated save can bypass the editor's parsing restrictions. Ownership checks limit note access but do not make its HTML safe to execute. Added `sanitize-html` with an explicit editor-compatible allowlist at both card sinks, shared by server rendering and client updates. Existing notes need no migration or destructive rewrite. See the [rendering contract](architecture.md#security-and-future-boundaries) and the sanitizer's [official documentation](https://github.com/apostrophecms/apostrophe/tree/main/packages/sanitize-html#readme).

**Verification:** five focused HTML tests and the existing 60 sync/queue/diff tests pass (65 total); lint/type checks and the production/Serwist build pass. Four production-preview browser tests pass: malicious saved title/body, malicious browser-only recovery content in Notes and Browser work, and existing light/dark authored-card color regressions. Tests verify unsafe elements are absent, their execution marker is absent, normal formatting survives, and rendering does not rewrite stored/recovery content. Independent visual review passes at 1440/390 in the existing Bookish/light appearance with a blue note: headings, marks, Vietnamese, list start, quote, code, HR, focus, contrast, and overflow checked. The review browser was closed; local Vercel analytics scripts returned 404. Development-page checks repeatedly reloaded before reaching assertions both before and after the fix; those attempts do not establish an exploit reproduction or a passing development flow. Production-preview checks passed independently. The fix has not been deployed by this review.

## Deferred scope

No Phase 4 is defined or approved. Automatic content merging, retained server history, search, full offline operation, E2EE, drawing, and additional export formats require their own scope. The [current encryption plan](../../note-encryption-plan.md) supersedes the original plaintext-title assumption.
