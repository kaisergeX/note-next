# Recovery UX: continue work from Notes

Status: product direction agreed on 2026-10-28; visual design owner-accepted on 2026-10-29, including the subsequent request to remove the Notes toolbar bottom border. Current focused regressions, HTTP, lint/types, and production build pass. Independent UI review was stopped by a locked Chrome profile; final completion and explicit boundary checks remain pending in [handoff](handoff.md). This document supersedes the separate Drafts collection UX, not persistence safety contracts.

## Goal

Notes is the user's working collection, including work not yet saved to the server. Minimize actions and management. Users should continue writing without understanding recovery records, sessions, or storage layers.

Use icons for routine status, with accessible names and tap/keyboard-accessible details. Color alone is insufficient. Animation is optional, transient, and respects reduced motion. Use short visible wording when a decision or risk cannot be made clear by an icon. Quiet successful saving needs no permanent badge or toast.

## Collection and opening behavior

| State | Notes presentation | Opening behavior |
| --- | --- | --- |
| Saved, no pending work | Ordinary card | Ordinary editor |
| One unambiguous local continuation | Same card showing local title/body/color; compact browser-only status icon | Resume automatically, reconcile, and save when safe |
| New note not yet saved to server | Card in Notes, with browser-only status icon | Continue editing; acquire server identity without creating a second card |
| Distinct competing versions | One note card with a warning and short Review action | Review versions associated with that note; never silently choose by timestamp |
| Original confirmed unavailable | Same Notes list, with an unavailable warning and inclusion in Needs review | Preview work and explicitly Save as new note, Export, or Discard |

Do not classify a failed request as a deleted note. Preserve local work when remote freshness cannot be checked; show a retryable status. Avoid claiming a conflict is resolved until checked.

For an ambiguous note, the saved version may provide the main card preview, but the warning must make competing work discoverable. Do not preview one version and silently open another. Multiple local candidates belong inside that note's review. Preserve the existing server/local comparison and guarded actions; extend selection only as needed for multiple distinct local versions.

The routine journey is edit → close → see the same work on the same card → reopen and continue. No Recover button, collection switch, or success acknowledgement is required. Do not automatically open a comparison dialog while the user is typing; keep a persistent Review action instead.

Remove Drafts as a primary destination. Existing Drafts/recovery links and account-exit Review must still lead to the corresponding work in Notes. Keep technical export and bulk discard in secondary management controls, without building another competing notebook. Trash remains separate because deletion is a deliberate lifecycle state.

## Presentation

- Reuse the shared note cards and authored colors across Notes and Trash. Keep blank titles blank; use subdued empty-content treatment only when needed.
- A status icon occupies a consistent place and supports pointer, touch, keyboard, and screen readers. Suggested short details: Only in this browser, Saving, Retry. Use wording that accurately distinguishes local durability from server success.
- Conflicts may show Review; unavailable originals need a brief explanation and Save as new note. Storage failure needs explicit guidance to keep the page open or export. Do not hide data-loss risk behind a tooltip.
- Do not show routine checkpoint timestamps on cards. In review, label timestamps by their actual meaning, such as Stored in this browser. Checkpoint time is not necessarily edit time and cannot rank the correct version.
- A compact collection-level attention indicator is appropriate when affected notes would otherwise be easy to miss. Count affected notes, not internal copies. Avoid repeating the same explanatory text on every card.
- Keep card identity and position stable when a local note receives its server identity. Do not repeatedly reorder the collection on local checkpoints or make recovery cards flicker while browser storage loads.
- Local recovery applies to this browser. Do not imply cross-device availability, permanent backup, an offline-launchable app, or background saving while the app is closed.

Exact icon choices, short EN/VI copy, and layout remain subject to visual feedback. The principle is minimal wording, not zero accessible labels or zero explanation.

## Safety and implementation constraints

- Join the server collection and account-scoped browser work by logical note/creation identity. Grouping the UI is not permission to delete underlying records.
- Distinguish an unambiguous continuation, equivalent copies, and genuinely distinct work. Do not use latest timestamp, matching visible text, or note ID alone as proof that another version is disposable.
- Preserve baselines, rich HTML, themes, retry identities, in-flight intent, generation checks, ownership, and live edits from other tabs. Existing equivalent-copy grouping is useful evidence, not a complete note-level presentation model.
- Resume/retire safely only after durable handoff; old controllers must not recreate retired copies. Automatically remove proven redundant recovery after safe acknowledgement/handoff so users do not have to clean it up. Preserve uncertain or distinct work.
- The collection and all editor entry points must share the same version-selection behavior, including normal links, mobile/full views, direct recovery URLs, and reloads. Do not fix only the card click handler.
- Keep bounded autosave and automatic server creation. Do not introduce idle polling, per-card remote reads, or full collection refreshes on each keystroke/save.
- Preserve conditional conflict resolution, explicit recovery for unavailable originals, and informed discard. Ordinary Trash and local Discard must not become ambiguous: explain which work is removed when pending versions exist. Never silently discard separate local work when trashing a server note.
- Maintain account-exit retention/discard behavior and local storage failures. A storage read failure must not look like an empty recovery collection.

## Implementation sequence

1. Inspect the current working-tree diff and retain unrelated owner work. Trace identity, reconciliation, and live-controller handoff before choosing the smallest shared collection/opening mechanism.
2. Implement integrated Notes and consistent resumption, including new local notes and stable server-identity transitions. Preserve all recoverable work during migration from the existing UI.
3. Attach exceptional review to notes; handle unavailable originals; update navigation/account-exit links and remove obsolete Drafts UI/copy only when replaced.
4. Present desktop/mobile visuals for owner feedback. During active feedback defer lint, types, builds, tests, and reviewers under AGENTS.md.
5. Once settled, run focused regressions, pnpm lint, elevated Turbopack build, and one scoped ui_reviewer at a time. Update the docs to describe the actual delivered behavior and verification limits.

## Acceptance scenarios

- Block only /api/note/sync, edit title/body/color, close, and reopen from Notes: one card reflects and resumes that work without visiting Drafts.
- A new local note appears in Notes; after successful save it remains one logical card. Lost-response retries do not create a second note.
- Reload, mobile/full-page navigation, direct links, and another tab preserve discoverability and consistent selection. Local loading does not briefly claim no work exists.
- Equivalent internal copies do not become duplicate cards; distinct local versions remain accessible within one note. Newer edits during resume/discard are retained.
- Server conflicts require a choice only when reconciliation cannot safely resolve them. Review later preserves work; guarded Keep both/Use mine/Use saved still behave correctly.
- Remote Trash/deletion never resurrects the original implicitly. Local work stays discoverable and can become a new note explicitly. Temporary network errors do not imply deletion.
- Browser storage failure and expired authentication remain actionable. Account switching does not expose another account's work.
- No routine manual cleanup, extra recovery confirmation, mandatory timestamp reading, or automatic conflict modal during typing.
- Verify EN/VI, desktop/mobile, light/dark, keyboard/touch, accessible status names, reduced motion, blank titles, and authored colors.

Out of scope: version history, paragraph merging, full offline support, new search, export formats, E2EE, production migration, and deployment.

## Accepted visual-feedback revision — 2026-10-29

The owner rejected the initial footer, chooser, and mixed-scope card menus. The working revision keeps exceptional items in the single Notes list with a sticky counted Needs review filter; it does not put recovery below an indefinitely growing feed. Saved-note card menus contain note actions, while selected browser versions carry their own Export/Discard controls in Review. Desktop Review compares the saved note with one selected browser version in aligned, independently scrollable panes. Mobile stacks the same panes with bounded previews. No version is chosen automatically by the selector. The owner accepted these layout refinements; safeguards above still apply.

Latest visual feedback keeps Create in the filter toolbar, restores original note-item menu sizing, packs mixed-height cards without grid row holes while preserving source order, and identifies browser choices by date/time. Extra per-pane description lines are removed. These refinements are owner-accepted; independent review remains pending.

Filters are hidden when there is no distinct review subset. Collection management stays at the left, away from the standalone expanding Create button. The masonry fallback is isolated in `use-masonry.ts`. Shared rounded menu actions, no added recovery-menu padding, and unclipped pane-control focus rings are the current feedback revision.
