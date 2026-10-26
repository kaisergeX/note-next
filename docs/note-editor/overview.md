# Note editor and persistence roadmap

Status: Phase 0 complete, 2026-10-27, for the authorized Tiptap dependency upgrade and migration verification. The user confirmed Vietnamese typing and save/reopen work, with undo/redo unchanged from before. Independent visual review found no upgrade-specific regression; its REVISE finding concerns a pre-existing code-block contrast defect tracked for Phase 1. Unrelated dependency advisories remain documented. Stages 1 and later are planning only. No deployment is included.

## Read order

1. This overview: accepted direction, boundaries, and delivery order.
2. [Editor rebuild](editor.md): dependency security, writing experience, and integration.
3. [Autosave and recovery](autosave.md): persistence, resource budget, and unresolved behavior.
4. [Conflict handling](conflicts.md): revision checks and recovery UX.
5. [Future encryption and offline support](future.md): constraints to preserve, not current implementation scope.

Each document separates accepted direction from proposed details and open decisions. Resolve open product decisions before implementing dependent behavior. Update these documents in place as decisions are made; record verification evidence only after running the checks. This folder is the active plan, not a claim about existing capabilities.

## Accepted direction

- Keep HTML as the authoritative stored format for rich-text titles and bodies. No Markdown or Tiptap JSON storage migration. Tiptap's internal document model is not the persistence format.
- Upgrade to a current patched Tiptap release and rebuild the editor integration, UI, and developer experience. Prefer a flowing document over a block-oriented notebook.
- Preserve existing visible formatting, including highlights and rich-text titles. Use the application's own design system and appearance presets.
- Add bounded autosave, truthful save status, local recovery, and conflict protection after the editor foundation is stable.
- No real-time collaboration or CRDT requirement. No Redis requirement; control traffic at the client and measure before adding infrastructure.
- Production stays on Vercel Hobby for the foreseeable future. Database provider/plan and active editing volume still need confirmation.
- Future encryption is opt-in per note body. Titles remain rich text and unencrypted. The intended protection requires client-side encryption with keys unavailable to the service (E2EE).
- E2EE is future work. Plan boundaries now without implementing key management, encryption, or speculative schema infrastructure.

## Delivery order and gates

| Stage | Work | Exit criteria |
| --- | --- | --- |
| 0 | Dependency security assessment and upgrade | Exact resolved versions/advisories checked; affected packages addressed; required migration changes verified. Do not wait for the complete UX redesign to address security. |
| 1 | Editor/session separation and UI rebuild | Existing formatting preserved; shared modal/full-page behavior; responsive typing and stable undo/selection; design feedback settled and required checks completed. |
| 2 | Local recovery and bounded autosave | New-note/logout decisions resolved; durable drafts and accurate status; idempotent retry behavior; revision enforcement integrated before release. |
| 3 | Conflict resolution UX | Same-field conflicts preserve work; stale resolutions rejected; keep-both and use-version paths verified. Ship stages 2–3 together if needed to avoid unsafe overwrites. |
| Later | Search, full offline operation, E2EE, drawing | Separate detailed designs and authorization. None is a prerequisite for stages 0–3. |

Do not equate sequencing with permission to implement all future stages. Current implementation authorization covers Phase 0 using the latest stable Tiptap release. See [Phase 0 evidence](editor.md#phase-0-implementation-and-verification) for versions, advisories, checks, and limitations.

## Existing contracts to preserve

- [DESIGN.md](../../DESIGN.md) and repository UI workflow instructions govern UI work. During active visual feedback, defer verification as instructed; once settled, run the required checks and one UI reviewer.
- [Note recovery and Trash](../note-recovery-trash.md) defines ownership, active/trash visibility, deadlines, and cleanup. Autosave must not weaken it.
- [Account data actions](../archive/account-data-actions.md) and [bulk Trash actions](../archive/trash-bulk-actions.md) define deletion coordination. Keep their transaction protections.
- Protected note responses currently have deliberate service-worker caching exclusions. Local recovery must be an explicit account-scoped data store, not blanket caching of authenticated responses.

## Terminology

- **Revision token:** an opaque concurrency value for rejecting stale writes. It does not imply retained historical content.
- **Recovery draft:** local unsynced work and the baseline needed to reconcile it.
- **Version history:** user-visible historical snapshots. Not included in this roadmap's initial implementation.
- **Local recovery:** durable browser drafts; not a guarantee the whole application can launch or browse notes offline.

## Decisions still needed

- When a new draft creates a server note, and how users discard it afterward.
- Logout/account-switch handling when unsynced drafts exist.
- Recovery retention, browser-storage failure behavior, and multi-tab coordination.
- Exact toolbar/interactions and supported formatting inventory after auditing existing notes and code.
- Production database plan, editing volume, and measured save budget.

Suggested defaults live in the individual documents. They are not accepted product decisions merely because they appear here.
