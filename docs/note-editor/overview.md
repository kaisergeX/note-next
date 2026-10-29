# Note editor and persistence roadmap

Status: Phase 2 is complete locally; minimum Phase 3 conflict safety is implemented and accepted. See [completion evidence and release limits](handoff.md). Production migration/deployment remain separate.

## Read order

1. This overview for scope, then [Handoff](handoff.md) for final evidence and next work. [Recovery UX](recovery-ux.md) defines the accepted presentation.
2. [Editor](editor.md): editor boundaries, upgrade evidence, and earlier verification.
3. [Autosave](autosave.md): current persistence/UI contracts, budget, verification, and open items.
4. [Conflicts](conflicts.md): concurrency and resolution rules.
5. [Future work](future.md): deferred search, offline operation, E2EE, and drawing.

## Delivery state

| Phase | Scope | State |
| --- | --- | --- |
| 0 | Tiptap security assessment and upgrade to 3.32.0 | Delivered; unrelated advisory limits remain in editor.md. |
| 1 | Editor/session separation and UI rebuild | Delivered and accepted; HR EOL correction and Vietnamese IME owner-confirmed on 2026-10-28. Follow-up evidence and device/production limits in editor.md. |
| 2 | Local recovery and bounded autosave | Delivered locally; scoped boundary checks, 39 regressions, HTTP, lint/types, build and focused UI re-review PASS. Fixture cleanup complete; release/device limits in handoff. |
| 3, minimum | Revision checks, field reconciliation, persistent conflict review | Implemented and accepted; detailed diffs/manual merging/history remain deferred. |
| Later | Search, full offline operation, E2EE, drawing | Separate design and authorization required. |

## Accepted direction

- HTML remains authoritative for rich-text titles and bodies. No Markdown/Tiptap JSON storage migration, CRDT, Redis, or generic editor framework.
- Preserve rich-text titles, existing formatting/highlights, EN/VI, appearance presets, and editing history.
- Zustand holds active memory state; Dexie 4.4.7 holds account-scoped browser recovery; PostgreSQL/Drizzle holds server notes.
- Production uses Vercel Free/Hobby and Vercel-integrated Neon PostgreSQL Free. Owner estimate: 10–20 active users, about 10 editing for 30 minutes daily. Use bounded saving and measure before further optimization.
- Future E2EE is opt-in per body; titles remain unencrypted. No encryption implementation is included.

## Accepted Phase 1 decisions — 2026-10-27

- One toolbar targets the active title/body. Bold, italic, underline, highlight, undo/redo are directly available; grouped controls retain lists, headings, quote, code, and clear-format actions.
- Modal/full-view navigation preserves the active editor/draft. Theme and persistence updates must not reset focus, selection, or undo.
- Full-view navigation hands off to the sticky toolbar using measured geometry. Mobile uses full-page editing; desktop retains modal/full-page choice.
- Existing undo grouping remains unchanged. Changes require evidence and agreement.
- Phase 1's save-on-close-only behavior is historical; Phase 2 supersedes it.

## Accepted Phase 2 decisions — 2026-10-27

1. Create only after meaningful content, including horizontal rules. Empty open/close and color-only changes create nothing. Server identity acquisition preserves editor instances.
2. Local debounce: 500 ms, max wait 2 s. Server pause: 3 s; scheduled minimum interval: 10 s; continuous typing max wait: 30 s. Explicit saves share the queue; no idle polling.
3. Allow navigation after a durable local checkpoint when server saving fails. Protect memory-only work; unload cannot await persistence.
4. Restore/reconcile local work automatically; same-field conflicts require review. The original separate Drafts discovery is superseded by recovery-ux.md: work belongs in Notes. Trash remains separate; preserve existing note links/modal routing.
5. Account exit offers Review, Keep and continue, and confirmed Discard. Retention is browser/account scoped, without automatic expiry; browser cleanup can remove it.
6. Old acknowledgements cannot clear newer generations. Automatic recovery preserves other-session copies. Explicit reopening replaces captured copies only after durable resumption; newer source generations remain. Queue regressions and recovery route/hydration boundary checks pass; see handoff for evidence.
7. UUID revisions, independent title/body/theme reconciliation, persistent review, and guarded Keep both/Use mine/Use saved are required.
8. Remote Trash/deletion stops saving; recovery as a new note is explicit. Account deletion clears local account recovery when storage is accessible.
9. Stable creation/mutation identities make lost-response retries safe. Preserve ownership checks, owner locks, lifecycle protections, and content-free logging.
10. Settings' Move all notes to Trash affects saved notes and excludes browser drafts. Local Export/Discard remains separate in scope; recovery-ux.md moves management out of the primary writing flow.

## Contracts and workflow

- [DESIGN.md](../../DESIGN.md), [Trash lifecycle](../note-recovery-trash.md), [account actions](../archive/account-data-actions.md), and [bulk Trash](../archive/trash-bulk-actions.md) remain authoritative.
- Protected note/collection responses bypass service-worker caching. Browser recovery is not an offline-launchable application or permanent backup.
- Obtain approval for product/design proposals. During visual feedback defer checks/review; after acceptance run required checks and one reviewer at a time.
- Revision tokens identify server state, not user-visible history.
- Remaining verification limits and the local-only migration status are listed in [autosave](autosave.md#verification-and-open-items).
