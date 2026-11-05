# Note editor and persistence

Phases 0–3, including Edit a copy, are complete locally and owner-accepted as of 2026-11-05. This folder is the maintenance reference for the completed feature.

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

## Release limits

Production migration `drizzle/20261027120859_note_autosave` and deployment require separate authorization; migration evidence is local only. The target is Vercel Hobby with Neon Free for roughly 10–20 active users; measure actual traffic and database amplification before optimizing.

Before release, refresh the historical dependency/HTML-safety assessment. Stored HTML rendering remains an explicit [security boundary](architecture.md#security-and-future-boundaries). A worker-enabled run emitted React hydration error 418; general PWA hydration is not cleared by the persistence suite. Physical-device/IME, actual fullscreen, exhaustive locale/appearance/engine coverage, and production performance remain unverified.

## Deferred scope

No Phase 4 is defined or approved. Automatic content merging, retained server history, search, full offline operation, E2EE, drawing, and additional export formats require their own scope. Future opt-in E2EE protects bodies; titles remain plaintext. Preserve that boundary without adding speculative encryption infrastructure.
