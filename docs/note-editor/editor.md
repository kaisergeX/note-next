# Editor rebuild

Status: Phases 0–1 delivered and user-accepted, 2026-10-27. Final lint/type checks, build, and focused tests passed; broad and focused independent UI reviews are PASS within the coverage below. Remaining manual/device, boundary, and production checks are explicit. See [overview](overview.md) for accepted scope and delivery order.

## Accepted requirements

- Retain Tiptap; upgrade to a current patched release after checking current documentation and advisories.
- Flowing document experience, app-owned UI, existing appearance presets, EN/VI localization, keyboard and mobile support.
- Rich-text titles, rich-text bodies, highlighting, and existing visible formatting remain supported. Underline was explicitly added in Phase 1.
- HTML remains authoritative. No storage-format rewrite is required by the editor upgrade.
- No collaboration, new document features, or encryption implementation in this stage.

## Current implementation and boundaries

The current editor integrates the delivered Phase 1 foundation with Phase 2 persistence:

1. **Editing:** NoteEditor owns Tiptap setup, HTML changes, and cached field counts. One instance per mounted field preserves selection/history across theme, status, and ordinary acknowledgement updates. useEditorState supplies targeted subscriptions.
2. **Writing surface:** NoteWriting coordinates title/body focus and RTECommands. Modal headers remain compact; full-view headers hand off to the sticky toolbar. Mobile uses full-page editing, with tap-to-toggle word/character counts.
3. **Session/persistence:** useNoteSession delegates to NoteSyncSession. Zustand keeps active memory state; Dexie keeps account-scoped recovery. Autosave, explicit leave, retry identity, generation guards, and lifecycle protection are documented in [autosave](autosave.md).
4. **Concurrency:** server UUID revisions and independent title/body/theme reconciliation support persistent conflict review. Ordinary acknowledgements do not replace editor content; recovery/reconciliation and explicit resolution may. See [conflicts](conflicts.md).

Editing is blocked only for explicit leave/Trash operations, not background saving. Appearance persistence remains separate from draft recovery. Full offline operation, E2EE, and version history remain deferred.

Entry points: [creation](../../components/note/note-create.tsx), [dialog](../../components/note/note-dialog.tsx), [full view](../../components/note/note-full-view.tsx), [modal](<../../app/[locale]/(note)/eton/@modal/(.)[id]/note-detail-modal.tsx>), and [read-only rendering](../../components/note/trash/note-read-only.tsx). The phase-specific verification below records historical coverage; [current Phase 2 evidence](autosave.md#verification-and-open-items) supersedes its persistence limits.

## Upgrade and content compatibility

- Check current Context7 documentation and applicable local Next.js guides before implementation. Read the Tiptap migration guide for the actual target release.
- Inventory all configured nodes, marks, shortcuts, custom behavior, and rendering paths, including title rendering on cards and previews.
- Verify existing HTML against the new schema before allowing writes. Keep originals recoverable; unsupported content must not be silently stripped.
- Establish the clean editing baseline after initialization/normalization, without writing merely because the note was opened. Server concurrency tokens still refer to the fetched revision.
- Review safe rendering and URL handling wherever HTML is displayed. Library upgrades do not replace application validation.
- Benchmark meaningful representative notes before adding serialization optimizations; avoid full-document work on selection-only changes.

## Phase 0 implementation and verification

Recorded 2026-10-26. The user requested the latest stable release, not just the minimum security fix. `pnpm view @tiptap/core version` returned **3.32.0**. All six direct Tiptap packages and all resolved Tiptap packages now use **3.32.0**, previously **2.27.3**. Floating UI DOM **1.8.0** is the explicit v3 menu dependency. Implementation is saved in commit `f9a7d58`. HTML storage, rich-text titles, and existing formatting remain intact; no data migration or later-phase feature was implemented.

### Compatibility changes

This is the historical Phase 0 configuration. Phase 1 changes transaction subscriptions, enables underline, and moves title Enter focus as recorded below.

- React menus now import from `@tiptap/react/menus`; obsolete `tippyOptions` were removed. An initial inline Floating UI options object caused a transaction/render loop in browser testing; removing that unnecessary override fixed it.
- `shouldRerenderOnTransaction: true` preserves live counts and toolbar active/disabled states. Character-count storage is inferred directly because the compatibility package no longer exports the old storage type.
- Newly bundled Link, Underline, ListKeymap, and TrailingNode are disabled in editing and Trash rendering to preserve the existing schema, keyboard behavior, and document endings.
- Preserved nodes: paragraph, headings 1–6, blockquote, bullet/ordered lists and list items, code block, horizontal rule, hard break, text/document. Marks: bold, italic, strike, inline code, highlight. Existing title Enter suppression, limits, and save-on-close/back flows remain.
- Consulted Context7 migration/StarterKit docs, installed v3 React menu implementation, and the installed Next.js server/client component guide. Client boundaries and `immediatelyRender: false` remain intact.

### Completed production dependency audits

`pnpm audit --prod --json` completed before and after installation with registry access, superseding the earlier stalled attempt. Before: **5 advisories (2 high, 3 moderate)**. After: **4 advisories (2 high, 2 moderate)**, none in Tiptap. This is not a clean production audit.

| Package/version                                     | Advisory                                                                                            | Result                                                                                                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tiptap core 2.27.3 → 3.32.0                         | [GHSA-cp6q-959q-f8rh](https://github.com/advisories/GHSA-cp6q-959q-f8rh)                            | Addressed; patched >=3.30.4. Registry audit labels moderate; upstream labels high.                                                                          |
| Tiptap core                                         | [GHSA-j95f-988m-3j2f](https://github.com/ueberdosis/tiptap/security/advisories/GHSA-j95f-988m-3j2f) | Markdown parser issue introduced in v3.7.0, fixed in 3.30.5; target includes fix. Original v2 and this HTML-only integration do not use that Markdown path. |
| Zod 4.1.11 via Vercel functions → OIDC → CLI config | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)                            | High; constrained collection memory exhaustion. Patched >=4.6.6. Remains outside this Tiptap upgrade; direct app Zod is 4.6.7.                              |
| Undici 7.29.1 via AI SDK provider-utils             | [GHSA-4qv8-2p9j-2685](https://github.com/advisories/GHSA-4qv8-2p9j-2685)                            | Moderate; EventSource memory exhaustion. Remains; patched >=7.30.1.                                                                                         |
| Undici 7.29.1                                       | [GHSA-f72v-6w45-q472](https://github.com/advisories/GHSA-f72v-6w45-q472)                            | Moderate; subresource integrity algorithm handling. Remains; patched >=7.30.1.                                                                              |
| Undici 7.29.1                                       | [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c)                            | High; excessive content-encoding error handling. Remains; patched >=7.30.1.                                                                                 |

Affected dependency versions do not establish app exploitability; no app-specific exploit was demonstrated. The Tiptap attribute issue requires attacker-controlled attribute objects. This app loads HTML through configured extensions without custom attribute-object input. A separate pre-existing boundary remains: `NoteCardSummary` renders stored HTML with `dangerouslySetInnerHTML`, while note validation checks strings/lengths rather than sanitizing HTML. Upgrading Tiptap does not establish that arbitrary stored HTML is safe. Link support remains disabled in the editor.

### Verification evidence and limits

- `pnpm lint` passed TypeScript and ESLint after final compatibility changes.
- Elevated `pnpm build` passed Next.js/Turbopack and Serwist after final changes. Google Sans fallback-metric and Node experimental localStorage warnings remain.
- `pnpm peers check` reported only ESLint 10 versus existing plugins' declared <=9 ranges; no Tiptap peer conflicts.
- Restarted the dev server after Docker became available, as requested. Authenticated with the existing local QA user and created a dedicated `Phase 0 upgrade QA` fixture (ID `01a178ac-1e2d-fe9b-fef1-e6d96697ee23`), preserving unrelated notes.
- Chromium checks passed: bold rich-text title; body Ctrl+B, Ctrl+Z, Ctrl+Shift+Z; selection and highlight/undo/redo; toolbar Highlight preserved selection `[1,8]`; title Enter retained one paragraph; title count was correct.
- A representative HTML fixture parsed/serialized exactly with heading, bold/italic/strike/code/highlight, hard break, Vietnamese text, quote, nested list, ordered list starting at 3, language-tagged code block, and horizontal rule. Synthetic HTML clipboard paste retained bold and highlighted Vietnamese text. Saved formatting was present on reopening in modal and full-page editors.
- Independent UI review was initially unavailable; the follow-up audit below supersedes that limitation with an actual browser review and its findings.
- Vietnamese typing received user-reported manual smoke verification in the follow-up below; input-method/browser details and exhaustive composition cases were not recorded. Production long-note performance and a full appearance matrix remain unverified. Follow-up long-note and Trash smoke coverage is recorded below. No production corpus was accessed; representative fixtures do not prove compatibility for every historical note.
- Existing editor recreation on theme/loading dependencies and text-only empty detection remain Phase 1 concerns. No autosave, session redesign, E2EE, or offline behavior is claimed.

The broader acceptance checklist below remains open for Phase 1; these focused Phase 0 checks do not complete it.

### Follow-up audit — 2026-10-27

- Compared the upgrade commit `f9a7d58` with its parent and rechecked the current Context7 v2-to-v3 migration guide. Menu imports, Floating UI dependency, transaction rerendering, and disabled new StarterKit extensions match the migration requirements and intended compatibility scope. Both editing and Trash use the same retained node/mark schema.
- Registry lookup again returned **3.32.0** as the stable Tiptap release; the lockfile resolves all Tiptap packages to that version. No further dependency update was needed.
- A fresh production registry audit still reports **4 advisories (2 high, 2 moderate)**, all the previously listed Zod/Undici issues. No Tiptap advisory was reported. Those unrelated dependencies were not changed.
- Fresh `pnpm lint` and elevated `pnpm build` passed, including TypeScript, ESLint, Next.js, and Serwist. The Google Sans fallback-metric and Node experimental localStorage warnings persist. `pnpm peers check` still reports only the existing ESLint 10/plugin range conflicts; it does not pass globally.
- Independent `ui_reviewer` completed real Chromium coverage at 1440×1000 and 390×844: Bookish dark modal, temporary Paper & Ink light full-page preview, EN fixture and VI creation. Formatting, nested lists, title counts, mobile selection-menu positioning, Highlight/undo/redo, restoring original HTML, visible keyboard focus, and absence of page overflow passed. No console errors or upgrade-specific regression were observed.
- Reviewer verdict is **REVISE**, not PASS: nested `pre code` has unreadable contrast (Bookish dark measured **1.096:1**). The global `code` background overrides the contrasting `pre` surface; the relevant CSS is unchanged from `f9a7d58^`. Track this existing rendering defect for Phase 1: scope the inline-code background to inline code or make nested code backgrounds transparent, then verify neutral and colored-note prose. No shared styling was changed during this dependency audit.
- The reviewer withdrew a suspected mobile target-size finding after source inspection: visually 32px buttons already use `touch-target-expand`, which adds 4px on each edge for coarse pointers. Real coarse-pointer hit testing remains unverified; desktop bounding boxes alone do not establish a defect.
- Long-note development smoke inserted 19,000 characters and five additional keys, yielding 19,005 characters without an observed editing failure. Tool round-trip timings are not input-latency benchmarks. The test accidentally saved a dedicated QA draft (`01a1792f-0c3e-4ae5-726e-dd1d435b9214`); the parent moved only that note to Trash and verified its preview visually, all 19,005 characters, `contenteditable="false"`, and no page overflow. It remains recoverable in Trash. Rich-format Trash round trips and production performance remain unverified.
- User-reported manual verification: Vietnamese typing is fine, save/reopen works, and undo/redo behaves as before, sometimes removing a word or multiple words. No Vietnamese-specific regression was reported. This closes the Phase 0 manual smoke-check item; it is not an exhaustive IME compatibility certification.
- Phase 0 is complete within the authorized Tiptap security/migration scope. The pre-existing code-block contrast defect, undo grouping usability, and broader acceptance checks belong to Phase 1. The unrelated Zod/Undici advisories remain unresolved; completion does not mean a clean application-wide security audit or an overall visual-review PASS.

## Phase 1 implementation and scoped verification

Authorized 2026-10-27. Accepted decisions are recorded in [overview](overview.md#accepted-phase-1-decisions--2026-10-27). Implementation and completed verification are separated below; the reviewer PASS is scoped, not a claim of exhaustive platform coverage.

- `NoteEditor` now owns editing and field counts; a shared `NoteWriting` surface owns title/body focus and the persistent active-field toolbar. Presentation updates apply to the existing instance, without replacing content or history. Counts are cached by immutable document identity so selection-only transactions do not rescan/serialize content.
- `useNoteSession` shares the create/update/Trash close flow. The memory-only store keeps the identity, draft, acknowledged baseline, operation guard, and error. Modal/full-page handoff does not clear the draft or submit a write. Successful explicit leave clears the session; failures retain it. Existing owner/lifecycle-checked server mutations remain in use.
- The dialog uses the approved compact sticky header combining Back/view actions with formatting and one bottom divider. After further explicit approval, full view restores the original layout: a separate navigation header, title, and toolbar attached to the body surface. During the approach to docking, the header slides away and Back/desktop fullscreen slide into the toolbar; shadow/corner changes still wait for actual docking. Scroll/resize/title-height changes update presentation without replacing the editor. Reduced motion disables these transitions. Desktop exposes grouped style/emphasis/list/quote/code/history controls; mobile keeps bold, italic, highlight, undo, and redo visible and groups secondary controls in a compact panel. After eye-check feedback, title/body spacing and focus-only title-count placement were restored to the pre-Phase-1 values for each view, with the count layered above the body surface. Clear block formatting uses a distinct clear-all icon. Paragraph, headings 1–6, lists, quote, inline/block code, strike, rule, clear marks, and clear blocks remain available. Existing hard-break and nested-list keyboard behavior/schema remain configured. Rich-text title Enter focuses the body.
- The user explicitly requested Underline. Editing and read-only Trash rendering now enable StarterKit’s bundled underline mark; the toolbar exposes U beside B/I in EN/VI. Underline uses the built-in Mod+U shortcut and HTML `<u>` output; no dependency or storage-format change is required. The settled review below verified underline save/reopen and read-only Trash rendering. The user approved exposing Strikethrough, inline code, horizontal rule, and both clear-format actions directly when the toolbar container has enough desktop width. Named Tailwind container queries retain the grouped panel for narrower toolbars; mobile and the H1–H6 picker remain as approved. No other new formatting feature is inferred. The original full-view docking/slide layout is restored following explicit approval; the user accepted the revised layout before the completed review below.
- Follow-up visual feedback requested matching toolbar/footer translucent surfaces, keeping the view action at the far right of the header, restoring the original footer count behavior (full-page words visible, desktop characters on hover; no counts in modal footer), and using a pencil icon with the short “Unsaved” / “Chưa lưu” label for pending edits. These changes passed the user’s eye check before the settled review. Counts initialize from the current editor before its first selection transaction.
- The footer distinguishes unsaved changes, saving, saved/empty draft, and failure. This remains save-on-close/back; it does not imply autosave or durable recovery. Writing is temporarily blocked only during an explicit leave/Trash operation.
- Emptiness uses the editor's structural emptiness check instead of `getText()` truthiness. Nested `pre code` backgrounds are transparent within shared prose, leaving the code-block foreground/background pairing intact for neutral and colored notes.
- No dependency change, autosave, revision checking, conflict UX, encryption, offline support, or storage-format migration is part of Phase 1.

### Completed checks and UI review — 2026-10-27

The user accepted the eye check and explicitly requested the UI reviewer round. An earlier reviewer was stopped during active design feedback and had no final verdict. The settled review completed with **PASS** after two confirmed regressions were corrected and verified on fresh source:

1. Restored original desktop footer clearance (`sm:pr-16` after scroll >200) so the global Scroll to top control cannot cover More note actions. At scroll 400.5, More measured `(1328,952,32,32)` and pointer hit-testing returned its own button.
2. Formatting availability now follows explicit session pending state instead of stale editor options. After an aborted save, Bold is enabled and both editors are editable without requiring refocus. No editor recreation, content replacement, or synthetic history transaction was added.

- Final `pnpm lint` passed TypeScript and ESLint after both corrections.
- Final elevated `pnpm build` passed Next.js/Turbopack, TypeScript, and Serwist after both corrections. Existing Google Sans fallback-metric and Node experimental localStorage warnings remain.
- `node --conditions=react-server --import tsx --test scripts/note-mutation.test.ts` passed all **5 tests**, covering transport/refusal outcomes, protected-response caching policy, Trash text summaries, and protected precache exclusions. These existing tests do not independently verify the new session/browser behavior.
- Targeted source scan found no new hex colors or arbitrary pixel values in changed editor/session feature files.
- Reviewer coverage: **1440×1000**, **390×844**, targeted **320×844**; **Paper & Ink/light** and **Bookish/dark**; **EN modal/full page**, **VI modal/full page**, and **read-only Trash**. No remaining HIGH/MED findings within this coverage.
- Rich title/body formatting including underline/highlight, heading, nested lists, code, and HR survived save/reopen. Trash preserved body formatting and was read-only. Title Enter focused the body; note theme changes preserved selection and undo/redo.
- Modal→full-page handoff retained an unsaved draft with **zero POSTs observed**. Failed save retained the editable draft and truthful error. Repeated close produced **one successful Next-Action POST** and visible Saving status. These observations do not establish future idempotent retry/revision semantics.
- VI disclosure labels reflowed; Tab exposed a **2px solid focus outline**, and Escape restored its trigger. Reduced-motion transition properties were `none`.
- Nested `pre code` backgrounds were transparent. Measured code contrast: **15.21:1 neutral / 8.50:1 blue** in Paper & Ink/light, **15.46:1 neutral / 8.08:1 blue** in Bookish/dark.
- At review time, mobile fullscreen wrapping was accepted: the docked full-page toolbar measured **96px** at 390px, with fullscreen on a second row; controls stayed **40×40**, reachable, with no horizontal overflow. Modal toolbar measured **57px** at 390px and **97px** at 320px. This was not reported as an accessibility blocker. After review, the user requested desktop-only fullscreen in full view. Its mobile header button and docked-toolbar wrapper are now hidden at the original `max-sm` breakpoint; the dialog’s Full page view link is unchanged. The user subsequently accepted the visibility/handoff adjustments; the focused re-review below verifies the final version. These earlier heights describe the preceding reviewed version.
- Stale development HMR caused an intercepted-route 404 and delayed source updates during review. Restarting the dev server and fresh navigation restored modal opening/reopening; no validation or routing configuration was weakened.

### Final focused handoff re-review — PASS

The user reported the full-view navigation header covering formatting controls during the approach to docking. The old threshold hid the higher-layer header only once the toolbar reached its sticky top. The user explicitly approved starting the handoff at the header's lower edge, using measured `offsetHeight`; actual docking independently controls shadow/corner changes. Stable untransformed height avoids feedback from the slide-out transform. The user eye-checked the result before the final verification round, as requested.

After the mobile-fullscreen visibility and earlier-handoff corrections, `pnpm lint` (TypeScript + ESLint), elevated `pnpm build` (Turbopack + Serwist), and `git diff --check` passed. Existing build warnings are unchanged. The five earlier mutation tests were not repeated because mutation/persistence code did not change in these follow-ups.

The second completed reviewer round was restricted to these fixes and nearby layout behavior, with no repeat of the broad audit:

- **PASS**, Paper & Ink/light, blue QA note, **1440×450**, **390×450**, and **390×844**.
- Desktop header height **64px**: scroll **140** begins handoff at toolbar top **64px**; header hidden and toolbar Back/fullscreen accessible. Scroll **204** docks the toolbar at top **0**, with shadow and **16px** bottom corners.
- Mobile handoff at scroll **124**, docking at **188**. Fullscreen button and wrapper both compute `display:none`; wrapper width **0**. Toolbar height **56px**.
- Paused scroll-down/up samples around both thresholds showed no lingering obstruction or oscillation; Back hit-testing remained correct. No horizontal overflow. Back measured **40×40**, with visible **2px** keyboard focus outline. Reduced-motion transitions computed `none`; no console errors recorded.
- The reviewer made **no content edits, saves, settings, or appearance changes** and closed its browser/released the profile afterward.
- Physical-device inertial scrolling and actual fullscreen activation remain unverified. Other editor behaviors retain the prior scoped evidence; this focused PASS does not repeat or expand that coverage.

### Cleanup and verification limits

Dedicated existing QA fixture `01a17bd9-8b4d-4c01-e1c9-06c6ec767ccc` is active with its original canonical HTML title/body and blue theme restored through the app save flow. Authenticated reads confirmed the restored values. QA appearance was restored and confirmed server-side as `paper-ink` / `light`. Both review and cleanup browsers were closed; no new fixture, permanent deletion, or unrelated note change was performed.

Still unverified: real Vietnamese IME for the rebuilt integration (Phase 0 had user-reported smoke coverage), maximum character-limit boundary, physical touch/virtual keyboard/safe areas, actual fullscreen entry, production typing performance, exhaustive appearance combinations, and **HR-only document persistence**. Representative documents containing HR passed round trips; that is not the HR-only case. These limits keep the broader checklist below partially open; no exhaustive acceptance or production performance certification is claimed.

Undo grouping remains unchanged. Evaluate it after confirming history no longer resets; agree on a new granularity only if evidence/user feedback supports a change.

## Acceptance coverage and follow-ups

Checked items have the scoped evidence above. Unchecked items remain unverified; they do not represent reported failures.

- [x] Formatting survives load/edit/save/reopen for representative HTML, including rich-text titles, underline, highlights, nested lists, code, and HR (reviewer scope above; no production corpus audit).
- [ ] Vietnamese IME composition, paste, nested lists, selection, undo/redo, and long-note editing behave correctly.
- [ ] Theme changes and background status updates preserve focus, cursor, selection, and undo history.
- [x] Modal/full-page handoff preserves the observed active draft without a navigation-triggered write; repeated close produced one successful request in the reviewed flow.
- [ ] Character limits and counts work without excessive rerenders.
- [x] Keyboard, mobile viewport, representative appearances, and EN/VI reviewed under the repository UI workflow; scoped PASS recorded above.
- [x] Focused existing regression tests, lint/type checks, final build, and settled-design UI review completed; evidence and limits recorded above.

## References

- [Tiptap upgrade guide](https://tiptap.dev/docs/guides/upgrade-tiptap-v2)
- [HTML and JSON output](https://tiptap.dev/docs/guides/output-json-html)
- [Free Simple Editor UI reference](https://tiptap.dev/docs/ui-components/templates/simple-editor)

The UI reference is optional inspiration, not authorization to replace the application's design system.
