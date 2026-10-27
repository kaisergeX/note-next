# Autosave and local recovery

Status: implemented and owner-accepted; scoped checks and UI review passed on 2026-10-28. The reported white draft-card case remains unreproduced. This is not a deployment sign-off.

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

## Device and Sync status

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
- Current acknowledgements clear only eligible generations. Other-session recovery copies remain until explicitly discarded; no silent expiry.
- Account exit offers Review, Keep and continue, and confirmed Discard. Keep checkpoints locally before allowing the pending action. Discard stops/drains account controllers and clears that account's local recovery before continuing. Close cancels; confirmation Cancel returns to the choices.
- Account deletion clears account recovery when storage is available; report cleanup failure. Remote Trash/deletion stops saves and permits explicit recovery as a new note/export, never automatic resurrection.
- Quota/storage errors remain visible. Browser cleanup/eviction can remove recovery; it is not a permanent backup.

## Collections and editing UI

- /collection/drafts and /collection/trash share the note feature shell. Existing /eton/[id] and modal routing are unchanged; old /trash links redirect.
- Drafts and Trash share compact title/numeric-count styling. Drafts has a back icon on the title row; Trash has none. Draft search is left below the header; bulk actions sit at the header's right.
- Preview cards reuse note themes/rich summaries. Blank titles stay blank; only empty content gets a subdued placeholder. Per-item menus offer Export/Discard.
- Export all/Discard all apply to the listed account's confirmation snapshot regardless of search. Transactional owner/generation checks retain newly created or updated drafts.
- Settings' Move all notes to Trash affects saved notes, including archived notes, and explicitly excludes browser drafts.
- Mobile editing uses full-page routes: /full/eton/new, /full/eton/[id], /full/eton/recover/[draftId]. Desktop retains modal/full-page choice. Mobile counts toggle words/characters on tap; desktop retains hover behavior.
- NotePersistence uses useWindowEvent for window events. Document visibility and captured navigation clicks remain document listeners.
- Confirmations use the library Dialog through ConfirmationDialog and its Header/Title/Content/Footer sections.
- Export is a JSON recovery backup of HTML plus sync metadata, with no import UI. Readable HTML export was discussed but not approved; DOCX remains unimplemented.

## Server and budget

POST /api/note/sync validates authenticated ownership, same origin, strict payloads/size, active state, and expected revision under the owner lock. Stable creation/mutation identities cover lost responses. Creation-key tombstones survive note deletion and cascade on account deletion. See [conflicts](conflicts.md).

Avoid per-save list/RSC refreshes and plaintext content logging. The list reconciles on leaving; note/collection HTML and RSC responses remain network-only in the service worker.

Owner budget: Vercel Free/Hobby + Neon PostgreSQL Free, 10–20 active users, approximately 10 editing 30 minutes daily. A 10-second minimum gives an upper planning estimate of 180 scheduled attempts per session, about 54,000 per 30 days, plus explicit flushes/retries/other traffic. Continuous typing generally reaches the 30-second schedule. This is neither a forecast nor a provider-quota guarantee; requests are not SQL-statement counts.

Measure content-free request counts, payload size, latency, errors, and DB/list-read amplification before optimizing. Preserve consistency protections; no Redis or write-behind service is needed for the accepted scope.

## Verification and open items

Owner visual acceptance is complete. Final lint/type checks, production build, and scoped independent UI review passed. Build warnings remain for Google Sans fallback metrics and experimental Node localStorage.

| Evidence | Result |
| --- | --- |
| Save/reconciliation queue tests | 20/20; includes lost responses, edits during requests/reads, storage failures, and bulk-Trash checkpoint races. |
| Mutation/service-worker policy tests | 5/5; includes collection paths and protected precache exclusions. |
| Earlier disposable-DB account/repository suite | 43/43; unchanged repository behavior. |
| Earlier authenticated sync HTTP suite | 1/1; auth, isolation, validation, idempotence, revision and Trash boundaries. |
| Real-browser persistence | Empty open/close has no save; creation preserves editor DOM/focus/Undo; visibility/review reopening refresh remote content; stale Use mine is rejected; Keep both follows its copy. |
| Real-browser bulk/logout checks | Snapshot deletion retains newer/new/foreign drafts; Keep retains data; Cancel preserves it; confirmed Discard removes only the requested account. Exit callback was stubbed, not real sign-out. |
| Independent UI review | PASS: Bookish light/dark, 1440x1000 and 390x844; Notes/Drafts/Trash, editor, logout, synthetic long conflict review. Search alignment corrected and rechecked. Formatting/themes, focus, mobile tabs/counts/toolbar handoff passed. |

All temporary parent/reviewer fixtures were cleaned up; no existing notes were changed during this verification. Dark fixture prose/timestamp contrast measured 6.05–11.89:1.

Open or limited:
- **Reported defect:** owner sees white draft cards although the editor has the correct color. Green/blue/pink fixtures render correctly; the affected record has not been reproduced. Do not mark fixed.
- Independent reviewer did not exercise real-server conflict resolution or actual sign-out completion. Parent stale-resolution/reopen checks are recorded above.
- Mobile status pointer activation was obstructed by the development badge; keyboard activation passed. Contrast coverage is representative, not exhaustive.
- Physical keyboards/IME/touch/safe areas, real offline/reload/auth-expiry/account-switch flows, production performance, and representative traffic measurement are not exhaustively verified.
- Migration drizzle/20261027120859_note_autosave was applied locally only. Production migration/deployment are outside the performed work.

References: [Dexie](https://dexie.org/docs/API-Reference), [browser unload limitations](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event).
