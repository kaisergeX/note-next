# Autosave and local recovery

Status: Phase 2 is complete locally. Current verification and release/device limits are consolidated in [handoff](handoff.md).

## Notes integration

Notes joins saved notes and account-scoped browser work by note/creation identity. One unambiguous continuation resumes automatically; distinct versions require selection. Local acknowledgements update the same card without per-save collection refreshes or reordering. See [recovery UX](recovery-ux.md) for presentation and opening behavior.

## Scheduling and queue

| Event | Behavior |
| --- | --- |
| Edit | Update memory; checkpoint locally after 500 ms, max wait 2 s. |
| Typing pause | Schedule server saving after 3 s. |
| Frequent pauses | At least 10 s between scheduled attempts per session. |
| Continuous typing | Attempt within 30 s, subject to in-flight work/failure backoff. |
| Unchanged note | No writes, save animation, polling, or idle traffic. |
| Explicit close/back/save | Flush through the same queue. |
| Hidden page | Best-effort checkpoint/flush; do not rely on unload delivery. |
| Visible page/reopened review | Deduplicated uncached read; reconcile against current local content. |
| Temporary failure | Keep recovery; bounded retry/backoff with Retry available. |

One request per session may be in flight. Coalesce newer edits without changing the submitted snapshot or its retry identity. Acknowledgements advance only that baseline; generation guards prevent clearing newer local work.

Meaningful title/body text or HR creates a note; empty paragraphs or theme-only changes do not. Server identity acquisition does not remount editors. Browser suspension/termination can lose changes not yet checkpointed.

## Editor Device and Sync status

One icon opens a click/tap/keyboard popover with two icon/text rows: Device and Sync. No outside status text, hover opening, or native title tooltip.

- Device: Saved only for the current durable generation; Saving while awaiting its checkpoint; Failed on storage error; No draft after acknowledged recovery is cleared.
- Sync: Queued, Syncing, Saved, Failed, Conflicting edits, or Unavailable as applicable.
- Queued pulses, active saving spins, failures use a destructive circle-X, and conflicts/unavailable originals use a warning triangle. Motion respects reduced-motion preferences.
- Closing unchanged content never flashes Saving. Local checkpoints are not repeatedly announced.

## Recovery and account lifecycle

Dexie 4.4.7 uses the separate etoN-note-recovery database. Records contain account/session identity, stable creation identity, baseline/revision, draft HTML/theme, generation, timestamps, and ambiguous in-flight retry data. Account isolation is not encryption.

- Restore against the baseline; independently reconcile title/body/theme. Same-field differences pause server autosave for review.
- Allow leaving after a current local checkpoint if server saving fails; retain memory-only work if neither persistence path succeeds.
- Bulk-Trash notifications checkpoint before stopping editors/reloading. Failed checkpoints or edits arriving during a checkpoint preserve memory-only work.
- Current acknowledgements clear only eligible generations. Automatic recovery preserves other-session copies; no silent expiry. Explicitly opening a draft now stops/drains its previous in-memory controller and retires equivalent captured copies only after the resumed session is durable. Different work and newer generations remain.
- Account exit offers Review, Keep and continue, and confirmed Discard. Keep checkpoints locally before allowing the pending action. Discard stops/drains account controllers and clears that account's local recovery before continuing. Close cancels; confirmation Cancel returns to the choices.
- Account deletion clears account recovery when storage is available; report cleanup failure. Remote Trash/deletion stops saves and permits explicit recovery as a new note/export, never automatic resurrection.
- Quota/storage errors remain visible. Browser cleanup/eviction can remove recovery; it is not a permanent backup.

## Collection, editing, and management contracts

- Existing `/eton/[id]` note links/modal routing remain supported. `/collection/drafts` redirects to Notes; Trash remains separate. Mobile uses `/full/eton/new`, `/full/eton/[id]`, and `/full/eton/recover/[draftId]`. A durable recovery handoff adds `?draft=<current ID>` without replacing the route segment; an available server identity receives the normal full-note URL.
- Equivalent-copy grouping requires account, note/creation identity, HTML/theme, baseline, conflict/unavailable state, and retry intent to agree. Grouping alone never authorizes deletion. Distinct versions remain accessible within their note.
- Export all/Discard all use the account's captured confirmation snapshot, regardless of filters. Owner/generation checks retain newer or newly created records. Settings' Move all notes to Trash excludes browser drafts.
- Blank titles remain blank; previews retain authored rich text/colors. Mobile counts toggle words/characters on tap; desktop retains hover behavior.
- Confirmations use the shared `ConfirmationDialog` around the library Dialog. Window events use `useWindowEvent`; visibility and captured navigation listeners remain on document.
- Export is JSON containing HTML and recovery metadata, with no import UI. Readable HTML/DOCX exports remain outside the approved scope.

## Server and budget

POST /api/note/sync validates authenticated ownership, same origin, strict payloads/size, active state, and expected revision under the owner lock. Stable creation/mutation identities cover lost responses. Creation-key tombstones survive note deletion and cascade on account deletion. See [conflicts](conflicts.md).

Avoid per-save list/RSC refreshes and plaintext content logging. The list reconciles on leaving; note/collection HTML and RSC responses remain network-only in the service worker.

Owner budget: Vercel Free/Hobby + Neon PostgreSQL Free, 10–20 active users, approximately 10 editing 30 minutes daily. A 10-second minimum gives an upper planning estimate of 180 scheduled attempts per session, about 54,000 per 30 days, plus explicit flushes/retries/other traffic. Continuous typing generally reaches the 30-second schedule. This is neither a forecast nor a provider-quota guarantee; requests are not SQL-statement counts.

Measure content-free request counts, payload size, latency, errors, and DB/list-read amplification before optimizing. Preserve consistency protections; no Redis or write-behind service is needed for the accepted scope.

## Verification and open items

See the [completion record](handoff.md) for verification and release limits.
