# Editor rebuild

Status: Phase 0 complete, 2026-10-27; Phase 1 design pending. See [overview](overview.md) for accepted scope and delivery order.

## Accepted requirements

- Retain Tiptap; upgrade to a current patched release after checking current documentation and advisories.
- Flowing document experience, app-owned UI, existing appearance presets, EN/VI localization, keyboard and mobile support.
- Rich-text titles, rich-text bodies, highlighting, and existing visible formatting remain supported.
- HTML remains authoritative. No storage-format rewrite is required by the editor upgrade.
- No collaboration, new document features, or encryption implementation in this stage.

## Current implementation observations

Inspected on 2026-10-26; recheck before implementation:

- `components/note/note-editor.tsx` combines editor setup, formatting menus, character counts, appearance lookup, and store integration.
- `store/note.ts` has one shared `mutateNoteData` slot. `store/index.ts` persists appearance only; note drafts are memory-only.
- Create, modal, and full-page editors have separate save-on-close/back flows.
- The editor's `loading` prop disables editing and participates in editor dependencies. Background saves must not use this blocking state.
- Change handling checks `getText()` before emitting HTML. Audit preservation of valid non-text content and formatting-only documents.

Relevant entry points: [editor](../../components/note/note-editor.tsx), [creation](../../components/note/note-create.tsx), [dialog](../../components/note/note-dialog.tsx), [full page](<../../app/[locale]/(note)/eton/[id]/note-detail.tsx>), [modal](<../../app/[locale]/(note)/eton/@modal/(.)[id]/note-detail-modal.tsx>).

## Proposed architecture

1. **Editor:** owns editing, selection, composition, formatting, and undo/redo; exposes content changes and explicit loading of a different document.
2. **Note session:** owns identity, current title/body/theme, acknowledged baseline, dirty state, and save status. Modal and full-page views use the same behavior. Define handoff/unmount behavior so navigation does not lose pending drafts.
3. **Persistence:** owns local storage and server synchronization. It must eventually accommodate encrypting a body before transport without putting encryption inside toolbar/components.

Keep this boundary small and specific to the app. Do not build a generic multi-editor framework. Changing appearance, counters, server acknowledgements, or save status must not recreate the editor or replace newer content.

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

- React menus now import from `@tiptap/react/menus`; obsolete `tippyOptions` were removed. An initial inline Floating UI options object caused a transaction/render loop in browser testing; removing that unnecessary override fixed it.
- `shouldRerenderOnTransaction: true` preserves live counts and toolbar active/disabled states. Character-count storage is inferred directly because the compatibility package no longer exports the old storage type.
- Newly bundled Link, Underline, ListKeymap, and TrailingNode are disabled in editing and Trash rendering to preserve the existing schema, keyboard behavior, and document endings.
- Preserved nodes: paragraph, headings 1–6, blockquote, bullet/ordered lists and list items, code block, horizontal rule, hard break, text/document. Marks: bold, italic, strike, inline code, highlight. Existing title Enter suppression, limits, and save-on-close/back flows remain.
- Consulted Context7 migration/StarterKit docs, installed v3 React menu implementation, and the installed Next.js server/client component guide. Client boundaries and `immediatelyRender: false` remain intact.

### Completed production dependency audits

`pnpm audit --prod --json` completed before and after installation with registry access, superseding the earlier stalled attempt. Before: **5 advisories (2 high, 3 moderate)**. After: **4 advisories (2 high, 2 moderate)**, none in Tiptap. This is not a clean production audit.

| Package/version | Advisory | Result |
| --- | --- | --- |
| Tiptap core 2.27.3 → 3.32.0 | [GHSA-cp6q-959q-f8rh](https://github.com/advisories/GHSA-cp6q-959q-f8rh) | Addressed; patched >=3.30.4. Registry audit labels moderate; upstream labels high. |
| Tiptap core | [GHSA-j95f-988m-3j2f](https://github.com/ueberdosis/tiptap/security/advisories/GHSA-j95f-988m-3j2f) | Markdown parser issue introduced in v3.7.0, fixed in 3.30.5; target includes fix. Original v2 and this HTML-only integration do not use that Markdown path. |
| Zod 4.1.11 via Vercel functions → OIDC → CLI config | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | High; constrained collection memory exhaustion. Patched >=4.6.6. Remains outside this Tiptap upgrade; direct app Zod is 4.6.7. |
| Undici 7.29.1 via AI SDK provider-utils | [GHSA-4qv8-2p9j-2685](https://github.com/advisories/GHSA-4qv8-2p9j-2685) | Moderate; EventSource memory exhaustion. Remains; patched >=7.30.1. |
| Undici 7.29.1 | [GHSA-f72v-6w45-q472](https://github.com/advisories/GHSA-f72v-6w45-q472) | Moderate; subresource integrity algorithm handling. Remains; patched >=7.30.1. |
| Undici 7.29.1 | [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c) | High; excessive content-encoding error handling. Remains; patched >=7.30.1. |

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

## Design decisions to settle

- Toolbar placement, selection menu, keyboard shortcuts, and mobile controls.
- Which current controls are essential versus redundant; preserve content compatibility even if controls move.
- Exact title formatting/Enter behavior and existing length constraints.
- Improve undo grouping: the user reports that undo can remove a whole word or multiple words, unchanged from before the upgrade. Agree on desired granularity before changing history behavior.
- How save status remains visible in both modal and full-page layouts without interrupting writing.

## Acceptance checklist

- [ ] Formatting survives load/edit/save/reopen for representative legacy HTML, including titles and highlights.
- [ ] Vietnamese IME composition, paste, nested lists, selection, undo/redo, and long-note editing behave correctly.
- [ ] Theme changes and background status updates preserve focus, cursor, selection, and undo history.
- [ ] Modal/full-page navigation preserves the active draft and does not create duplicate sessions/writes.
- [ ] Character limits and counts work without excessive rerenders.
- [ ] Keyboard, mobile viewport, appearances, and EN/VI reviewed under the repository UI workflow.
- [ ] Appropriate regression checks, lint/type checks, and build completed when design is settled; evidence recorded.

## References

- [Tiptap upgrade guide](https://tiptap.dev/docs/guides/upgrade-tiptap-v2)
- [HTML and JSON output](https://tiptap.dev/docs/guides/output-json-html)
- [Free Simple Editor UI reference](https://tiptap.dev/docs/ui-components/templates/simple-editor)

The UI reference is optional inspiration, not authorization to replace the application's design system.
