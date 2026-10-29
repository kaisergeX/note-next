# Concurrent edits and conflict recovery

Status: minimum Phase 3 safety scope implemented and owner-accepted with Phase 2. Optional detailed text comparison is implemented locally. Scoped verification and device/production limits are in [handoff](handoff.md). Manual merging and user-visible history remain deferred.

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
- **Review later:** keep the conflict and local work.

Opening review or returning to a visible tab performs a deduplicated uncached read. Preserve edits made during that read and refresh independent fields. Disable resolution while checking or after a failed freshness check; allow retry/dismissal. A newer server edit updates comparison rather than silently overwriting it.

Unavailable originals stop saves. Explicit recovery can create a new note; it never restores the original implicitly.

## Presentation

Use existing note themes and the read-only rich-text renderer for title/body formatting, highlights, lists, quotes, and color.

Desktop uses a wide workspace with borderless version panes separated by a divider. Formatted previews retain the authored note card surface, color, typography, and rich text inside each pane; do not add a second enclosing card. Mobile is full-screen with a single preview and accessible tabs (Arrow keys/Home/End, roving focus, associated panels).

Each preview scrolls independently; its version action stays visible without requiring a full read. Keep both stays above the tabs; Review later stays in the bottom footer without an extra divider. Long content must not push decisions off screen.

## Integrated browser-version selection

The shared editor gate no longer picks the first record when several distinct equivalent-copy groups exist. Notes attaches them to one note and presents a chooser before ordinary editing. Explicit selection preserves other groups; subsequent server conflicts still use guarded comparison. A persistent editor action keeps other browser versions discoverable. Same-route switches create a fresh session identity; captured equivalent cleanup waits for durable handoff. Only a confirmed 404 during Use saved marks the original unavailable; temporary read failures keep resolution blocked and retryable. See [handoff](handoff.md) for current limits.

Verification and release limits are consolidated in [handoff](handoff.md); scoped checks do not establish exhaustive device or production coverage.

## Detailed text comparison

Conflict review offers Show changes / Show previews. The optional comparison projects the current saved and browser HTML into text on the client; it never changes reconciliation, persistence, or resolution behavior. Each pane retains its own version's text. Underlines mark text added in the browser version; strikethrough marks text removed from the saved version. Screen-reader labels identify changed spans.

Show changes is a prominent filled button with a comparison icon; Show previews uses an eye icon. Note-color differences appear as a palette status badge, separate from note prose. The editor's Review changes, Review other versions, and Export draft actions share one wrapping row, with Review changes as the primary action. Keep both help uses the main ink color for readable contrast on its tinted surface.

Title and body are compared separately. Formatting/structure and note-color differences direct users back to the rich-text previews. This is not an inline rich-text formatting diff or a three-way baseline view. Changes to mark positions with unchanged text also receive a non-text difference notice.

Word comparison uses jsdiff 9.0.0 with a 50 ms / 1,000-edit bound per field. More than 100,000 combined text characters, or an aborted comparison, falls back to marking the whole changed field with an explanation. No content is truncated. Paragraphs, line breaks, and decoded entities remain text; HTML is never injected by the comparison.

## Deferred Phase 3 extensions

Manual merging and user-visible version history require scope agreement before implementation. No retained-history schema or merge algorithm has been approved.
