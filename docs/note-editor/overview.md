# Note editor and persistence roadmap

Status: Phases 0–2, minimum Phase 3 conflict safety, and detailed text comparison are delivered and owner-accepted locally. The Edit a copy extension is implemented and verified locally on 2026-10-30; its visible label is Working copy / Bản đang sửa. Production migration/deployment remain separate. Verification, unresolved reports, and release limits live in [handoff](handoff.md).

The 2026-10-31 continuation audit corrected two working-copy persistence regressions and completed a clean 35-case browser run. See the [audit record](handoff.md#continuation-audit--2026-10-31) for evidence and the scrolling review status.

## Delivery state

| Phase | Delivered scope |
| --- | --- |
| 0 | Tiptap upgrade to 3.32.0; historical security findings in [editor](editor.md#security-assessment-record). |
| 1 | Stable editor/session boundaries, active-field toolbar, rich-text titles, underline, view handoff, corrected HR insertion. |
| 2 | Account-scoped browser recovery, bounded autosave, integrated Notes discovery, lifecycle/account protections. |
| 3 | UUID revision checks, independent field reconciliation, guarded conflict review, optional word-level text differences. |
| 3 extension | Edit a copy inside conflict review: preserve the source browser version, edit a separate recovery version, then explicitly resolve. [Design and implementation plan](conflicts.md#approved-extension-edit-a-copy). Implemented locally; evidence and remaining limits are in the handoff. |
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
