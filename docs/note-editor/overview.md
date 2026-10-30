# Note editor and persistence roadmap

Status — owner decision, 2026-11-01: **Phase 3 and its Working copy extension have NOT passed. The owner considers the current changes a failure and rejects the implementation. NO deployment or production migration is approved.** `NoteSyncActions` is poorly designed, and the note-editor changes require redesign. A new thread will reassess the architecture and may rework the entire implementation. Earlier acceptance statements and passing checks below are historical evidence, not acceptance of the current changes. See the [current handoff](handoff.md#owner-decision--2026-11-01-failed-phase-no-deployment).

The 2026-10-31 continuation audit recorded persistence corrections and a 35-case browser run. Those results did not establish acceptable architecture or resolve the owner's subsequent rendering reports; they do not override the failed-phase decision.

## Delivery state

| Phase | Delivered scope |
| --- | --- |
| 0 | Tiptap upgrade to 3.32.0; historical security findings in [editor](editor.md#security-assessment-record). |
| 1 | Stable editor/session boundaries, active-field toolbar, rich-text titles, underline, view handoff, corrected HR insertion. |
| 2 | Account-scoped browser recovery, bounded autosave, integrated Notes discovery, lifecycle/account protections. |
| 3 | **FAILED / NOT ACCEPTED.** Existing revision/reconciliation/conflict-review code requires reassessment; its presence does not mean this phase passed. |
| 3 extension | **FAILED / NOT ACCEPTED.** Working copy and related note-editor changes require redesign or full rework in a new thread. The [earlier plan](conflicts.md#approved-extension-edit-a-copy) is historical, not approval of the current implementation. |
| Deferred | Automatic paragraph/change merging, retained version history, search, full offline operation, E2EE, drawing. Separate scope approval required. |

## Contracts and read order

1. [Handoff](handoff.md): current evidence, regression-sensitive boundaries, and next work.
2. [Editor](editor.md): editor ownership, formatting, upgrade/security record, and earlier acceptance evidence.
3. [Autosave](autosave.md): scheduling, durability, account lifecycle, routes, server budget, and recovery cleanup.
4. [Recovery UX](recovery-ux.md): Notes discovery, version selection, and collection acceptance scenarios.
5. [Conflicts](conflicts.md): revision/retry protocol, reconciliation, guarded decisions, and comparison presentation.
6. [Future constraints](future.md): deferred features and encryption/offline boundaries.

## Accepted direction

- HTML remains authoritative for rich-text titles/bodies. Preserve formatting, EN/VI, appearance presets, selection, and undo. No Markdown/JSON storage migration, CRDT, Redis, or generic editor framework.
- Zustand holds active memory; Dexie holds account-scoped browser recovery; PostgreSQL/Drizzle holds server notes. Revision tokens identify current server state, not retained history.
- Create only for meaningful title/body content, including HR. Empty open/close and color-only edits create nothing. Server identity acquisition preserves editors.
- Notes contains saved and browser work. Resume an unambiguous continuation automatically; competing versions require review. Trash remains separate. Temporary failures never imply deletion; recovery of unavailable originals as a new note is explicit.
- Generation/retry identities, ownership/owner locks, lifecycle checks, and durable handoff protect newer or other-session work. Browser recovery has no automatic expiry and is not a permanent backup or offline-launchable app.
- Target hosting is Vercel Free/Hobby with integrated Neon Free; owner estimate is 10–20 active users, about 10 editing 30 minutes daily. Keep bounded saving and measure before optimizing. Future opt-in E2EE protects bodies; titles remain unencrypted.
- [DESIGN.md](../../DESIGN.md), [Trash lifecycle](../note-recovery-trash.md), [account actions](../archive/account-data-actions.md), and [bulk Trash](../archive/trash-bulk-actions.md) remain authoritative. During visual feedback defer verification; after acceptance run required checks and one UI reviewer at a time.
