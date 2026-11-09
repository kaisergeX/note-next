# Note editor maintenance contract

This describes behavior that future changes must preserve. Implementation details and dependency versions belong in code and package.json; completed delivery status is in the [overview](overview.md).

## Ownership and code map

| Responsibility                  | Entry points                                                                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selected session and surfaces   | [NoteWorkspace](../../../components/note/note-workspace.tsx), [session hook](../../../components/note/use-note-session.ts)                                                                                    |
| Editable fields and toolbar     | [NoteWriting](../../../components/note/note-writing.tsx), [NoteEditor](../../../components/note/note-editor.tsx)                                                                                              |
| Persistence and reconciliation  | [NoteSyncSession](../../../lib/notes/session-sync.ts), [sync contracts](../../../lib/notes/sync.ts), [server route](../../../app/api/note/sync/route.ts)                                                      |
| Browser storage and equivalence | [drafts](../../../lib/notes/drafts.ts), [recovery copies](../../../lib/notes/recovery-copies.ts)                                                                                                              |
| Discovery and selection         | [Notes collection](../../../components/note/notes-collection.tsx), [version selection](../../../components/note/note-version-selection.ts), [recovery entry](../../../components/note/note-recovery-page.tsx) |
| Comparison                      | [conflict review](../../../components/note/note-conflict-review.tsx), [text diff](../../../lib/notes/diff.ts)                                                                                                 |

HTML titles and bodies remain authoritative. Preserve authored formatting, colors, blank titles, EN/VI input, selection, undo, and title/body limits. A meaningful title/body or HR creates a note; empty paragraphs, opening/closing, and color-only changes do not.

Each selected session owns one editable title/body pair, reused between writing and Working copy review. Theme changes, acknowledgements, server-ID acquisition, mobile tabs, and closing comparison preserve those instances. Explicit version changes may replace the session. Install recovered/reconciled content before publishing conflict state so subscribers cannot restore an obsolete snapshot.

NoteWriting owns active-field focus, workspace-local reading mode, and one toolbar; title Enter moves to the body. Saved mobile notes start read-only; new notes and conflict Working copies remain editable. Mode switches use `setEditable` without emitting content updates, preserving the editor instance and undo history. Entering Edit maps the native browser selection into the selected editor before focusing it. Pending session operations keep both editors and the mode action blocked. Selection-only changes should not serialize the full document. Keep editing/read-only schemas compatible; Link, ListKeymap, and TrailingNode are intentionally disabled. The scoped HR-at-paragraph-end command must preserve cursor placement and undo. Verify persisted HTML and renderer compatibility before changing extensions; opening a document must not silently strip or save content.

The desktop modal reuses one native shell across writing, version selection, and comparison. Initial choosers are separate entry surfaces. Full-page comparison retains outgoing content through its exit animation, then restores editing/focus. Each pane scrolls independently with visible decisions and an unclipped sticky toolbar; mobile comparison tabs preserve editor and scroll state. Nested Escape closes the active disclosure/confirmation first. Follow DESIGN.md and shared primitives for visual rules.

## Saving and durability

Zustand holds active memory; Dexie holds account-scoped recovery in `etoN-note-recovery`; PostgreSQL holds server notes. Recovery includes the baseline/revision, HTML/theme, identities, generation, timestamps, and ambiguous in-flight intent.

| Trigger                    | Contract                                               |
| -------------------------- | ------------------------------------------------------ |
| Editing                    | Local checkpoint after 500 ms; maximum wait 2 s        |
| Typing pause               | Schedule server save after 3 s                         |
| Frequent pauses            | At least 10 s between scheduled attempts per session   |
| Continuous typing          | Attempt within 30 s, subject to in-flight work/backoff |
| Explicit save/close/back   | Flush through the same queue                           |
| Hidden page                | Best-effort checkpoint/flush; no unload guarantee      |
| Visible page/opened review | Deduplicated uncached freshness read                   |

One request per session may be in flight. Coalesce newer edits while preserving the submitted snapshot and retry identity. Acknowledgements advance only that baseline; generation checks prevent clearing newer work. Unchanged notes produce no writes, save animation, polling, or idle traffic.

Clearing a never-submitted new draft retires its earlier browser checkpoint through the serialized local-write queue; generation guards preserve newer edits. An empty current draft must not suppress a retained creation request: acknowledge its exact retry identity first, then save the latest content against the acquired note ID.

Device status describes the current durable generation; Sync status describes server progress. Keep their meanings distinct. Use the accessible status popover for routine information and explicit guidance for actionable storage/authentication failures.

On server failure, allow leaving after a current local checkpoint. If both persistence paths fail, retain editable memory and prevent unsafe departure. Failed local reads must not appear as empty recovery. Suspension can lose uncheckpointed edits; browser recovery is neither a permanent backup nor offline-launchable operation, and has no automatic expiry.

Avoid per-save collection/RSC refreshes and plaintext content logging. Reconcile the list on leaving. Measure content-free request/payload counts, latency, failures, and database amplification before adding infrastructure.

## Discovery, handoff, and lifecycle

Notes joins saved and browser work by logical note/creation identity, with one stable card per note. One unambiguous continuation resumes automatically; distinct versions require selection and remain discoverable. Never rank the correct version by checkpoint time or matching visible text. Preserve authored previews, blank titles, card identity/order, and accessible warnings; do not interrupt typing with automatic comparison dialogs. Keep masonry source/keyboard order.

Equivalence includes account, note/creation identity, HTML/theme, baseline, conflict/unavailable state, and retry intent. UI grouping never authorizes deletion. Automatic resumption preserves other-session work. Explicit resumption stops/drains the old controller and retires only captured equivalent generations after durable handoff; newer/distinct records survive. Explicitly retained Working copy sources are an exception to redundant-copy cleanup.

All routes use locale prefixes. Preserve ordinary `/eton/[id]` links/modal entry, full views at `/full/eton/new` and `/full/eton/[id]`, and recovery at `/full/eton/recover/[draftId]`.

- Selection waits for hydration. The owner/note-scoped `version` query survives reload and modal/full navigation; `version=saved` explicitly opens saved-only editing. Removed/resolved selections fall back to saved without hiding other browser work.
- Recovery replacement uses `?draft=<current ID>` while keeping the route segment stable through RSC refresh. An available server identity receives its normal note URL without remounting editors.
- Browser work is the secondary `/collection/browser-work` route. Legacy Drafts and `?work=browser` links redirect there. Account-exit Review cancels the exit and opens this route.
- Fixed `from=browser-work` context survives selection, identity acquisition, reload, view handoff, and Keep both retries. Chooser dismissal and editor close/Trash return there; its back icon returns to Notes. Close comparison only dismisses the overlay. This value is not an arbitrary redirect target.
- After successful leave, suppress outgoing recovery resumption and URL handoff during navigation; reset the guard when a cached view disconnects so reopening works.

Account exit offers Review, Keep and continue, and confirmed Discard. Keep checkpoints before proceeding; Discard stops/drains controllers and clears only that account's recovery. Dismissal cancels the exit; canceling discard confirmation returns to the choices. On account change, hide cached views owned by the previous account until refreshed data matches; retain its durable work for its next sign-in. Account deletion reports local-cleanup failure.

Bulk Trash checkpoints before stopping/reloading editors; checkpoint failure or concurrent edits preserve memory-only work. Remote Trash/deletion stops saving and permits explicit recovery as a new note/export. Temporary failures never establish deletion or authorize resurrection.

Local export/discard operates on captured account/generation snapshots; bulk actions ignore presentation filters and preserve newer/newly created records. Server Trash and local Discard have distinct scopes. Settings' Move all notes to Trash excludes browser drafts. Export is JSON with HTML/recovery metadata; no import UI is included.

## Revisions and conflict decisions

UUID revisions identify current state, not retained history. A database trigger advances revision on every note UPDATE, including Trash/restore. Sync validates authentication, rendered owner, same origin, payload limits, active state, and expected revision under the owner lock. Stable creation/mutation identities acknowledge committed retries without duplicates. Permanent note deletion retains creation-key tombstones; account deletion cascades them.

Reconcile title, body, and theme independently against the acknowledged baseline: one side changed wins; identical changes agree; differing changes require review. Rich-text fields are indivisible, including different paragraphs in one body. Keep reconciliation client-side.

While conflicted, typing and local checkpoints continue; server autosave pauses. Review/focus freshness reads preserve edits made during transport and reconcile independent fields. Block decisions during a failed/pending freshness check; provide retry and dismissal. Only a confirmed unavailable response establishes unavailability.

| Decision                    | Required behavior                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| Use mine / Use this version | Conditional write against the displayed server revision; stale results return to review    |
| Use saved                   | Fresh read/revision check, informed discard, and captured local-generation guard           |
| Keep both                   | Preserve original; checkpoint creation intent before idempotently creating a separate note |
| Close comparison            | Preserve current editor, conflict, and local work                                          |

A lost Keep both response keeps the editor mounted with a durable URL for the pending copy; retries follow that copy's creation identity and later saved ID. Pass a URL string to native history so the service-worker navigation hook can clone it. Never leave reload pointing at the original or create a duplicate.

Show changes is a client-side, bounded word projection of saved/browser HTML, separate for title/body. Added text is underlined, removed text struck through, with accessible span labels. Formatting/structure/color differences direct users to previews. Oversized/aborted comparisons mark the whole changed field with an explanation without truncating content or injecting HTML. This display never changes reconciliation or saving.

## Edit a copy

Edit a copy makes one separately durable browser version from the selected version's title/body/theme and checkpoints its unchanged source first. It stays attached to the same note, has independent identities, and excludes the source's transport flight. Reopening/resuming the same source reuses its unresolved copy. The saved reference stays read-only.

Mark origin with a Working copy text badge and accessible explanation; it does not mean resolved or saved. Reuse the rich-text editor/toolbar in comparison, with the color picker immediately before the ellipsis. Composition remains local until an explicit decision; Close comparison, reload, tabs, and view handoff retain it.

Use this version conditionally replaces the original; Keep both creates a separate server note. Preserve the source until explicit discard, even when equivalent to the saved result or the new copy. Stale decisions update the saved reference without rewriting composed content. Confirmed Use saved discards the selected source/copy, not other distinct work.

Discarding a Working copy returns to its unchanged source; if that source was explicitly discarded, return to a live saved-note session. Undo is not durable restart. Compatible optional recovery fields are `versionId`, `editedCopyOf`, and `retainedSource`. Clear `editedCopyOf` after acknowledged resolution (including confirmation by a freshness read), so later ordinary edits resume independent-field reconciliation; preserve stable version identity for dirty continuations.

## Security and future boundaries

Only the author can access a note; conflicts describe that author's devices/tabs/sessions. Browser account isolation is not encryption. Protected note/collection HTML and RSC responses remain network-only in the service worker.

[NoteCardSummary](../../../components/note/note-card.tsx) sanitizes title/body HTML immediately before dangerouslySetInnerHTML using the shared [display sanitizer](../../../lib/notes/html.ts). This boundary applies during server rendering and client updates, including existing saved notes and account-scoped browser recovery copies. Never pass raw authored HTML to a new HTML sink.

The allowlist preserves editor headings, paragraphs, emphasis, underline, strike, highlight, lists (including ordered-list start), quotes, code/language classes, breaks, and HR. Scripts, event handlers, arbitrary CSS/classes/IDs, forms, embeds, SVG/MathML, and URL-bearing attributes are excluded. Links are deliberately unwrapped to text, matching the editor's disabled Link extension. Per-note themes are separate from authored HTML and remain unchanged. Any new editor extension requiring tags, attributes, URLs, or styles must extend and test this policy explicitly; do not enable sanitizer defaults wholesale.

Sanitization is a display projection, not a write transform. Server validation still checks ownership, state, strings, and lengths; database HTML, browser drafts, exports, revisions, retry identities, and conflict comparisons remain authoritative and unchanged. Do not treat raw API responses or JSON exports as safe HTML in another consumer. Editable and read-only note views use Tiptap's restricted StarterKit/Highlight schema with Link disabled; text summaries/diffs render escaped text. Editor parsing alone does not authorize arbitrary HTML insertion. The other app-level HTML sinks contain the fixed appearance bootstrap script, not note content.

The [2026-11-07 assessment](overview.md#html-safety-review-2026-11-07) records the HTML safety findings and verification. This closes the identified raw card-rendering gap locally; it is not an assurance against every vulnerability or confirmation of deployment.

Future E2EE is opt-in for bodies, with plaintext titles. Keep title/body transforms separable before transport/local storage and conflict handling usable without server parsing of bodies. Keys/recovery, local plaintext, transitions, backups/history, and privacy promises need a dedicated design; an encryption flag alone provides no protection. Do not claim retroactive secrecy or automatically delete old history.

Full offline launch requires its own shell/data availability, durable mutation queue, authentication/isolation, tombstone/reconnect, and eviction design. Search must distinguish plaintext titles from protected bodies. Drawing needs a separate format/undo model. None of these deferred features authorizes changing current HTML storage or adding a generic document framework.
