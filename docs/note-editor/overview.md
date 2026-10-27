# Note editor and persistence roadmap

Status: Phases 0–1 are delivered and accepted as of 2026-10-27. Phase 0 upgraded Tiptap to 3.32.0; Phase 1 rebuilt editing/session integration and the approved UI. Final lint/type checks, production build, and five focused existing mutation tests passed. Both the broad UI review and final scroll-handoff re-review are **PASS** within their recorded coverage. Manual/device, boundary, and production-performance limits remain explicit in [editor verification](editor.md#cleanup-and-verification-limits). Phases 2 and later remain planning only and require separate authorization. No deployment is included.

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

| Stage | Work | Status and gate |
| --- | --- | --- |
| 0 | Dependency security assessment and upgrade | Delivered. Tiptap 3.32.0 migration verified; unrelated dependency advisories remain documented. |
| 1 | Editor/session separation and UI rebuild | Delivered and user-accepted. Final checks and two scoped UI review rounds passed; manual/device and performance follow-ups remain open. |
| 2 | Local recovery and bounded autosave | Planning only; not authorized or implemented. Resolve creation/logout/storage decisions and integrate safe retry/revision behavior before release. |
| 3 | Conflict resolution UX | Planning only; not authorized or implemented. Verify stale-resolution protection and keep-both/use-version paths. Stages 2–3 may need to ship together. |
| Later | Search, full offline operation, E2EE, drawing | Separate detailed designs and authorization; none is a prerequisite for stages 0–3. |

Do not equate sequencing with permission to implement all future stages. Current implementation authorization covers completed Phase 0 and Phase 1 editor/session separation and UI rebuild using the accepted decisions below. It does not authorize autosave, durable recovery, conflict UX, new document features, encryption, offline support, or unrelated dependency fixes. See [Phase 0 evidence](editor.md#phase-0-implementation-and-verification) for versions, advisories, checks, and limitations.

## Accepted Phase 1 decisions — 2026-10-27

- **Formatting:** one toolbar targets the active rich-text title/body. Bold, italic, underline, highlight, undo, and redo are directly accessible. Desktop groups expose lists, quote, and code; sufficiently wide toolbar containers also expose Strikethrough, inline code, horizontal rule, and both clear-format actions. H1–H6 stay in the text-style picker; narrower/mobile toolbars retain a compact grouped panel. Underline is the only newly approved formatting feature, enabled in both editing and read-only Trash rendering.
- **Dialog layout:** compact sticky header combines Back, formatting, and the far-right Full page view action, with one bottom divider. Toolbar and footer share the translucent surface treatment.
- **Full-view layout:** separate navigation header, title, then toolbar attached to the body surface. Handoff begins when the toolbar reaches the header's measured lower edge: the header slides away and Back/desktop fullscreen slide into the toolbar. Shadow/corner changes wait for actual docking. Fullscreen and its wrapper take no space on mobile; the dialog's Full page view action remains available. Respect reduced motion.
- **Writing details:** retain rich-text titles, HTML storage, highlights, existing visible formatting, character limits, EN/VI, and the appearance system. Title Enter focuses the body. Keep original per-view title/body spacing and focus-only title counts, layered above the body. Full-view footer shows words and reveals characters on desktop hover; dialog footer has no counts.
- **Editor/session boundary:** keep editing/selection/history separate from identity, draft, acknowledged baseline, save state, and lifecycle actions. Theme/status changes update existing editor instances. Modal/full-page handoff retains the active in-memory draft without navigation-triggered writes. This is a small app-specific boundary, not a generic editor framework.
- **History:** eliminate unintended resets; keep existing undo grouping. Any granularity change needs evidence and user agreement.
- **Persistence:** retain save-on-close/back and existing Trash/deletion protections. Unsaved edits use a pencil icon with “Unsaved” / “Chưa lưu”; saving/failure states are truthful and failed saves retain the draft. No autosave, durable recovery, revision/conflict UX, encryption, or offline implementation is included.
- **Rendering:** structural emptiness replaces text-only checks so non-text nodes are retained in draft HTML. Nested `pre code` backgrounds are transparent within shared prose, preserving the contrasting block surface. HR-containing round trips passed; HR-only persistence remains unverified.
- **Workflow:** obtain approval before concrete UI/UX or behavior changes. During active visual feedback, defer reviewers/checks; after the user accepts the design, run required checks and one reviewer at a time. Close reviewer browsers, preserve unrelated data, and restore any temporary QA changes. Completed evidence is in [editor.md](editor.md#completed-checks-and-ui-review--2026-10-27).

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

## Decisions still needed before Phase 2

- Autosave creation timing and discard behavior after a server note exists. Phase 1 continues to create only on explicit close/back with content.
- Logout/account-switch handling when unsynced drafts exist.
- Recovery retention, browser-storage failure behavior, and multi-tab coordination.
- Production database plan, editing volume, and measured save budget.

Suggested defaults live in the individual documents. They are not accepted product decisions merely because they appear here.
