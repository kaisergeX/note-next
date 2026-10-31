# Concurrent edits and conflict recovery

Status: minimum Phase 3 safety scope implemented and owner-accepted with Phase 2. Optional detailed text comparison is implemented locally. Scoped verification and device/production limits are in [handoff](handoff.md). Edit a copy is implemented locally with owner-approved Working copy wording; verification and release limits are in the handoff. Automatic content merging and user-visible retained history remain deferred.

[Recovery UX](recovery-ux.md) governs Notes discovery and note-scoped selection; each internal recovery record must not become a separate note card.

## Revision and retry contract

UUID revisions identify current server state, not retained history. A database trigger advances revision on every note UPDATE, including lifecycle mutations, so stale sessions cannot write through a Trash/restore cycle.

1. Retain the acknowledged baseline and revision.
2. Send the snapshot, expected revision, and stable retry identity.
3. Atomically check owner, active state, and revision under the owner lock.
4. On mismatch, preserve local work and compare only a still-authorized active version. Trash/deletion is unavailable, not an ordinary content conflict.
5. Apply any resolution through another conditional write. Never force stale content through.

Stable creation keys and last-mutation identities distinguish committed retries from new work. Old acknowledgements cannot clear newer local generations. Account deletion removes account creation keys; permanent note deletion retains its creation-key tombstone.

## Field reconciliation

Compare base, local, and current server values independently for title, body, and theme:

- Only one side changes: use that side.
- Both sides produce the same value: accept it.
- Both sides differ: require review.

Rich-text title and HTML body are indivisible fields. Different paragraphs in one body still conflict; there is no HTML text merge or CRDT. Keep comparison on the client, preserving the future E2EE boundary.

## Resolution behavior

Typing/local checkpoints remain available while conflicted; server autosave pauses. A persistent Review action opens comparison without interrupting composition.

- **Keep both:** prominent global option above version tabs; retain the original and idempotently create a separate local-version copy.
- **Use mine:** replace only against the displayed server revision.
- **Use saved:** re-read/check the displayed revision and require informed discard; optional export is available.
- **Close comparison:** dismiss the editor's comparison overlay while keeping the current editor, conflict, and local work.

Opening review or returning to a visible tab performs a deduplicated uncached read. Preserve edits made during that read and refresh independent fields. Disable resolution while checking or after a failed freshness check; allow retry/dismissal. A newer server edit updates comparison rather than silently overwriting it.

Unavailable originals stop saves. Explicit recovery can create a new note; it never restores the original implicitly.

If Keep both has durable local work but no server acknowledgement, keep the editor mounted and point reload at that copy's recovery record. Manual/background retry follows the saved copy identity; a lost response must not duplicate the note or leave its URL pointing at the original.

## Presentation

Use existing note themes and the read-only rich-text renderer for title/body formatting, highlights, lists, quotes, and color.

Desktop uses a wide workspace with borderless version panes separated by a divider. Formatted previews retain the authored note card surface, color, typography, and rich text inside each pane; do not add a second enclosing card. Mobile is full-screen with a single preview and accessible tabs (Arrow keys/Home/End, roving focus, associated panels).

Each preview scrolls independently; its version action stays visible without requiring a full read. Keep both stays above the tabs; Close comparison stays in the bottom footer without an extra divider. Long content must not push decisions off screen.

## Integrated browser-version selection

The shared editor gate no longer picks the first record when several distinct equivalent-copy groups exist. Notes attaches them to one note and presents a chooser before ordinary editing. Explicit selection preserves other groups; subsequent server conflicts still use guarded comparison. A persistent editor action keeps other browser versions discoverable. Same-route switches create a fresh session identity; captured equivalent cleanup waits for durable handoff. Only a confirmed 404 during Use saved marks the original unavailable; temporary read failures keep resolution blocked and retryable. See [handoff](handoff.md) for current limits.

Verification and release limits are consolidated in [handoff](handoff.md); scoped checks do not establish exhaustive device or production coverage.

## Detailed text comparison

Conflict review offers Show changes / Show previews. The optional comparison projects the current saved and browser HTML into text on the client; it never changes reconciliation, persistence, or resolution behavior. Each pane retains its own version's text. Underlines mark text added in the browser version; strikethrough marks text removed from the saved version. Screen-reader labels identify changed spans.

Show changes is a prominent filled button with a comparison icon; Show previews uses an eye icon. Note-color differences appear as a palette status badge, separate from note prose. The editor's Review changes, Review other versions, and Export draft actions share one wrapping row, with Review changes as the primary action. Keep both help uses the main ink color for readable contrast on its tinted surface.

Title and body are compared separately. Formatting/structure and note-color differences direct users back to the rich-text previews. This is not an inline rich-text formatting diff or a three-way baseline view. Changes to mark positions with unchanged text also receive a non-text difference notice.

Word comparison uses jsdiff 9.0.0 with a 50 ms / 1,000-edit bound per field. More than 100,000 combined text characters, or an aborted comparison, falls back to marking the whole changed field with an explanation. No content is truncated. Paragraphs, line breaks, and decoded entities remain text; HTML is never injected by the comparison.

## Approved extension: Edit a copy

Status: owner-approved design, 2026-10-30; implemented and locally verified. The owner subsequently approved Working copy / Bản đang sửa wording and authorized verification. The approved behavior below remains authoritative; release and device limits are recorded in the handoff.

Only the author can see/edit a note. Conflicts come from that author's devices, tabs, or browser sessions; sharing and collaboration are not implemented. Use that language in explanations and status messages.

### Flow and explicit decisions

- Keep current conflict review and its Use mine, Use saved, and Keep both choices as the main flow. Add a secondary **Edit a copy** action to the selected browser version. The saved reference stays read-only; making both sides editable is outside this scope.
- Create a separate account-scoped browser recovery version initialized from the selected browser version's rich-text title, body, and theme. Preserve the source unchanged. This is an additional version attached to the same logical note, not a separate server note or collection card.
- Show the edited copy in the existing version list with a small **Working copy** text badge alongside its normal timestamp. An icon alone is insufficient. Provide an accessible origin label such as “Editable copy; original kept.” The badge identifies origin, not resolution, saved state, or completion; do not label it “Merged.”
- Reuse the existing rich-text editor and formatting toolbar inside comparison. Desktop shows the editable copy beside the read-only saved version so users can copy passages manually. Mobile uses editable-copy/saved-reference tabs, preserving selection and undo while switching.
- Further edits update that copy; keystrokes, reopening, and resuming it must not create additional versions. Preserve authored formatting, EN/VI, note color, and existing title/body limits.
- Editing does not select a winner or resolve the conflict. **Use this version** explicitly saves the edited result over the original server note against the reviewed revision. **Use saved** retains informed discard/freshness protections. **Keep both** explicitly creates a separate saved note from the edited result, preserving the existing idempotent creation/retry behavior.
- Checkpoint the edited copy locally while unresolved; do not autosave it over the server note. Close comparison retains the copy. Reload, editor view handoff, and version selection must retain it and its discoverability through the existing recovery flow.
- To start again, explicitly discard the edited copy and return to its unchanged source. Use existing scoped discard confirmation/generation safeguards. Undo is useful during editing but is not the durable restart mechanism. No separate hidden working copy, Cancel restoration snapshot, or Reset mechanism is required.
- After successfully saving the edited copy, retain the source browser version until explicit discard. Other distinct browser work remains available. Explicitly retained source versions must not be silently retired as equivalent copies, even before the edited copy's content diverges.
- If another device/tab/session updates the server note, preserve the edited result and require review against the newer saved revision before replacing it. Do not force a stale save or rewrite composed content underneath the user. Trash/deletion and temporary read failures retain the existing unavailable/retry distinctions.

### Implementation plan

1. Inspect `lib/notes/drafts.ts`, `recovery-copies.ts`, `session-sync.ts`, and the shared version gate/chooser before changing the model. Add the minimum copy-origin metadata and any required browser-storage migration. Preserve backward compatibility with existing recovery records; no server retained-history schema is needed.
2. Make source/copy preservation explicit in grouping, resumption, acknowledgement cleanup, and discard. Identity must distinguish an intentionally retained source from redundant internal copies. Retain owner checks, captured-generation cleanup, retry identities, durable handoff, account-exit behavior, and live edits from other tabs. Do not duplicate ambiguous in-flight server mutation intent into the edited copy; establish its own guarded resolution intent.
3. Extend the current review workspace and version list, reusing NoteEditor, RTECommands, note surfaces, shared dialogs/buttons, and semantic tokens. Add EN/VI labels. Preserve Browser work return context, accessible tabs/focus, bounded independent scrolling, and visible resolution controls.
4. Add meaningful regression coverage for original/copy preservation (including initially identical content), repeated editing/resumption, reload/view handoff, discard/start again, source retention after successful resolution, stale revision rejection, network/storage failures, account isolation, and Keep both lost-response retries. Preserve existing regression coverage.
5. During active visual feedback defer reviewer, lint, type checks, builds, and tests. Once the owner signals the design is settled, run required focused/browser regressions, lint/types, and production/Serwist build; request elevated execution on the first Turbopack build attempt. Run one required ui_reviewer at a time with desktop/mobile, EN/VI, light/dark, keyboard/focus, and authored-formatting coverage. Report changes, verified behavior, and remaining feedback separately.
6. Update this status, overview, recovery contracts, and handoff with actual implementation and evidence. Do not describe this approved design as delivered until implemented and verified.

### Implementation and verification

Recovery records now carry optional `versionId`, `editedCopyOf`, and `retainedSource` metadata. No indexed fields changed, so Dexie v1 and existing records remain compatible without a schema migration. Stable version identity participates in equivalence grouping and survives session-ID retirement. Creating a copy checkpoints the retained source before writing the new version, excludes its transport flight, and assigns independent creation/version identities. Selecting the same source resumes its existing unresolved edited copy. The source remains attached to the original note when Keep both creates another note.

Working-copy composition ends when a save is acknowledged (including confirmation by a freshness read) or Use saved succeeds. Clear `editedCopyOf` at that boundary so later ordinary edits reconcile independent remote fields on reload; preserve stable version identity for any still-dirty continuation. Retained sources also preserve all authored fields on stale resolution responses and require renewed review instead of automatic reconciliation/retry.

The comparison reuses NoteWriting/NoteEditor/RTECommands, with read-only saved content, a secondary Edit a copy action, Working copy badges, and Use this version. Mobile tabs and the preview/diff toggle hide rather than unmount the editor. Closing comparison refreshes the underlying editor from the composed snapshot and retains the comparison editor through the exit animation. Version selection retains native modality while the outgoing dialog fades, then hands off the session; rapid clicks cannot reopen the outgoing session. Source/copy content bypasses automatic reconciliation during conflict resumption/freshness reads; a rejected conditional save updates only the saved reference. Even identical explicit choices send a revision-guarded mutation.

The optional `version` URL parameter carries stable browser-version selection through reload and modal/full navigation; lookup stays scoped to the current owner and note. A resolved/removed selected version falls back to the saved note while other browser work stays discoverable. Browser work return context remains independent.

All 45 focused sync/queue/diff tests pass, including six new model regressions. The 23 existing browser cases passed; all nine new working-copy cases passed across focused reruns on the final build, and the two existing chooser cases were rerun after the handoff correction. This covers 32 unique browser cases with zero retries, rather than a single clean 32-case execution. Lint/types, formatting, and the production/Serwist build pass. Independent UI review and its limits are recorded in the handoff.

Retained-source Keep both preserves that version under the original note before creating the separate note. Confirmed Use saved explicitly discards its selected retained source. If the source was already explicitly discarded, discarding its working copy starts a live saved-note session. History updates pass strings (`url.href`) to avoid sending uncloneable URL objects through the Serwist navigation hook. The worker-enabled browser regression checks that handoff specifically; broader worker reload/hydration behavior is not cleared by it.

### Scope boundary

This is manual composition within existing review, not a Git-style merge engine. No new merge library, automatic paragraph merge, per-change accept/reject controls, three-way baseline view, CRDT, sharing/collaboration, or server version history. Browser recovery remains device/browser-local and is not permanent backup.

## Deferred Phase 3 extensions

Automatic content merging and user-visible retained version history require separate scope agreement. No retained-history schema or merge algorithm has been approved.
