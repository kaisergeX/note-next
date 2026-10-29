# Note editor handoff — 2026-10-29

Delivered and owner-accepted locally: editor rebuild, bounded autosave/recovery, minimum conflict safety, and detailed text comparison. See [overview](overview.md) for scope and [conflicts](conflicts.md) for the settled comparison design.

## Regression-sensitive boundaries

- Incidental rerenders reuse the active controller; explicit version choices may replace it. Install recovered/reconciled content before publishing conflict state: publishing first let the store subscription overwrite local work with initial saved content. A reproducing regression failed before the correction and now passes; reload preserves local HTML/theme and independent remote changes.
- Durable handoff uses `?draft=<current ID>` so reload finds the replacement while RSC refresh preserves the editor tree. Available notes receive normal URLs; unavailable originals retain recovery URLs. Retire only captured equivalent generations after durable resumption.
- Direct Review → Open saved starts a saved-only session and keeps the chooser mounted until navigation. Do not mount the old recovery editor during that navigation. Other distinct browser versions stay accessible.
- A lost Keep both creation response must leave the live editor on a durable copy recovery URL, then follow its saved ID when retry succeeds. Use native history for the pending handoff: RSC navigation can race a retry clearing the source record. Recovery reload uses the existing resumption path; the original stays unchanged.

## Verification

| Evidence | Scope/result |
| --- | --- |
| Focused automated suite | 39 sync/queue/diff regressions pass via `pnpm test:notes:sync`; includes conflict hydration, retry/generation safety, freshness reads, and bounded text comparison. |
| Disposable local database | 43 account/repository regressions passed during the source audit: revisions, stale writes, retries, ownership, lifecycle transitions, deletion, and cleanup. |
| Authenticated sync HTTP | Passed same-origin/auth/payload boundaries, account isolation, retries, conflicts, and remote Trash. |
| Repeatable browser suite | 9 EN/desktop Chromium regressions passed twice (18/18, zero test retries), with fresh temporary accounts/contexts. Covers Notes recovery, modal/full handoff, durable draft URLs, conflict reload/RSC identity, guarded Use mine/Use saved, lost-response Keep both in place/after reload, failed freshness-read blocking, and competing versions after Open saved. [Run instructions and limits](browser-tests.md). |
| Final static/build checks | Lint/types and production/Serwist build pass. Existing Google Sans fallback-font and Node localStorage warnings remain. |
| Browser behavior | Recovery reload, same-editor RSC refresh, server-creation reload, unavailable Save as new, cross-tab discard preserving newer work, real sign-out with Keep, synthetic 401 guidance/retention, and continued access to other versions after Open saved passed. Earlier parent checks covered stale Use mine rejection and navigation to the Keep both copy. |
| Text projection | EN/VI words, formatting-only title, entities, paragraphs/line breaks, HR structure, script/style exclusion, and nested structure bounds passed parent checks. |
| Final independent UI review | PASS: 1440px desktop, 390×844 mobile, EN/VI, Paper & Ink light/dark; restored authored cards/divider, action wrapping, palette badge, eye/comparison icons, keyboard focus/toggle/tabs, independent scrolling and pinned choices. Destructive resolution actions were excluded from this visual pass. |

The former Keep both help contrast issue is fixed: 11.12:1 dark and 14.06:1 light. Latest temporary browser/database fixtures were removed, preferences restored, and automation browsers closed. Earlier editor/HR/IME evidence is summarized in [editor](editor.md#acceptance-evidence).

## Open items and release limits

- The earlier white draft-card report remains unreproduced and unconfirmed; no evidence establishes whether it persists after Notes integration. Triage it before claiming closure.
- Migration `drizzle/20261027120859_note_autosave` is locally applied only. Production migration and deployment require a separate release step.
- Physical touch/virtual keyboard/safe areas, actual fullscreen entry, exhaustive IME/appearance/browser combinations, real cookie expiry/second-account switching, and production traffic/performance are not exhaustively verified. Owner IME smoke and synthetic 401 checks do not close those broader limits.
- The [historical dependency audit and stored-HTML rendering boundary](editor.md#security-assessment-record) are not an application-wide security clearance.

## Suggested next work

Repeatable browser regressions are delivered. Next triage the white-card report and complete device/account release checks; these remain recommendations, not new implementation authorization. Manual merging is the next optional feature; agree on its UX and conditional-save behavior before coding. Retained history requires a separate storage/retention decision. Other deferred features remain in [future](future.md).
