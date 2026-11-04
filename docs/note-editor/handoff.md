# Note editor handoff

## Current status — 2026-11-05

The owner accepted the redesigned Phase 3 surfaces after visual feedback, with one requested adjustment. The Working copy color picker now sits immediately left of the ellipsis. Phase 3 completion awaits the verification below. **Production migration and deployment remain unauthorized.** The [historical record](archive/2026-10-phase-3-history.md) preserves the 2026-11-01 rejection of the earlier implementation and the scope of earlier checks.

## Implementation

- `NoteWorkspace` coordinates writing, attached versions, comparison, and resolution. `NoteSyncActions` renders status/actions. `NoteConflictReview` renders comparison. Each selected session owns one editable title/body pair, reused in writing and working-copy review. Writes are scoped to the active session identity.
- The desktop note modal uses one native shell for ordinary editing, attached-version selection, and comparison. Full-page comparison retains outgoing content through its exit animation, then restores the editor and focus. Initial route/recovery choosers remain separate entry surfaces.
- Explicit selection waits for hydration, then persists a durable owner/note-scoped version or source identity in the URL. Browser work return context survives selection, reload, and identity handoff. See [recovery UX](recovery-ux.md) for route behavior.
- Resolution stays visible while pending and returns stale choices to review. Use saved checks the latest revision and the captured local generation. Keep both checkpoints creation intent before transport. See [conflicts](conflicts.md) for the decision and retry contract.

## Regression-sensitive boundaries

- Incidental rerenders reuse the active controller. Explicit choices can replace it. Install recovered or reconciled content before publishing conflict state so subscribers cannot overwrite it with the initial saved snapshot.
- Durable handoff uses `?draft=<current ID>` so reload finds the replacement while route refresh preserves the editor tree. Available notes receive normal URLs and unavailable originals retain recovery URLs. Retire only the captured equivalent generations after durable resumption.
- Direct Review → Open saved starts a saved-only session. Keep the chooser mounted through navigation and keep distinct browser versions discoverable.
- After a lost Keep both response, the live editor uses a durable recovery URL for the pending copy, then follows the saved ID on acknowledgement. Use native history during the pending handoff to avoid a route refresh racing record cleanup. The original remains unchanged.
- On live account change, hide cached views that still carry the previous owner's data until refreshed routes match the current account. Preserve the previous owner's durable local recovery.
- Successful leave suppresses recovery resumption during navigation. Reset that guard when a cached view disconnects so reopening can create or resume its editor normally.

## Verification

| Check | Current result |
| --- | --- |
| Focused sync, queue, and diff | 53/53 passed |
| Isolated database and repository regressions | 43/43 passed |
| Lint/types and production/Serwist build | Pending |
| Browser regression suite | Pending |
| Independent UI review | Pending |

Exploratory EN/light desktop and mobile checks covered working-copy rendering, long-content scrolling and the sticky toolbar, close/reopen with undo, comparison tabs, chooser transitions, and a held stale resolution. The [browser runbook](browser-tests.md) describes repeatable persistence coverage.

## Open items and release limits

- Migration `drizzle/20261027120859_note_autosave` has local evidence only. Production migration and deployment require separate authorization.
- Actual fullscreen, physical-device/IME coverage across appearances and engines, general service-worker hydration, and production performance remain open. See the [editor security record](editor.md#security-assessment-record) for the historical dependency audit and stored-HTML rendering boundary.
- The local visual-feedback fixture `1f2a8966-f4e3-4afc-8ff9-43a76bc40694` and its scoped browser versions were retained for feedback. Browser-local records are specific to the automation profile. If cleaning up after review, target only this fixture and its versions.
