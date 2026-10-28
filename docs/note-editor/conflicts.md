# Concurrent edits and conflict recovery

Status: minimum Phase 3 safety scope implemented and owner-accepted with Phase 2. Scoped verification passed; limits and the open draft-card report are in [autosave](autosave.md#verification-and-open-items). Detailed diffs, manual merging, and user-visible history remain deferred.

The integrated Notes direction in [recovery-ux.md](recovery-ux.md) changes discovery and adds note-scoped selection when multiple local versions exist. The revision, reconciliation, and guarded resolution contracts below remain required. Existing comparison presentation is the starting point, not a requirement to expose each recovery record as a separate note.

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

Desktop uses a wide workspace with side-by-side version cards. Mobile is full-screen with a borderless, space-efficient single preview and accessible tabs (Arrow keys/Home/End, roving focus, associated panels).

Each preview scrolls independently; its version action stays visible without requiring a full read. Keep both stays above the tabs; Review later stays in the bottom footer without an extra divider. Long content must not push decisions off screen. The temporary visual-feedback preview route has been removed.

## Verification

Queue/reconciliation tests cover independent/same-field edits, lost acknowledgements, edits during freshness reads, remote Trash, and read failure/retry. Repository/HTTP checks cover ownership, revisions, lifecycle restrictions, and idempotent creation/update replay.

Parent browser checks verified review reopening with newer remote content, retained local edits, rejection of stale Use mine, and navigation to the Keep both copy. Independent review passed synthetic long-note layout, formatting/themes, mobile tab keyboard behavior, visible choices, and pinned footer. Its real-server resolution coverage remains unverified.

See [the consolidated evidence and remaining limits](autosave.md#verification-and-open-items); passing scoped checks is not an exhaustive device/production certification.

## Integrated browser-version selection — current checks and remaining review

The shared editor gate no longer picks the first record when several distinct equivalent-copy groups exist. Notes attaches them to one note and presents a chooser before ordinary editing. Explicit selection preserves other groups; subsequent server conflicts still use guarded comparison. A persistent editor action keeps other browser versions discoverable. Same-route switches create a fresh session identity; captured equivalent cleanup waits for durable handoff. Only a confirmed 404 during Use saved marks the original unavailable; temporary read failures keep resolution blocked and retryable. See [handoff](handoff.md) for current limits.

On 2026-10-29, the integrated design was owner-accepted. The current combined queue/policy suite passes 39 tests, the authenticated sync HTTP suite passes, and lint/types plus the elevated production/Serwist build pass. New cases explicitly cover preserving local work for Use saved HTTP 503/401 and marking unavailable only on 404, owner/creation identity matching, same-route controller replacement, and equivalent copies arriving after the handoff snapshot. The required UI reviewer did not inspect any states because its Chrome profile was locked. Final review and the recovery-route/repeated-hydration boundary checks in [handoff](handoff.md) remain outstanding. The earlier independent PASS above is historical.
