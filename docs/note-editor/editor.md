# Editor implementation and upgrade record

Status: Phases 0–1 delivered and owner-accepted. HR correction and rebuilt-editor Vietnamese IME smoke were owner-confirmed on 2026-10-28. Current persistence/conflict evidence and release limits live in [handoff](handoff.md).

## Current implementation and boundaries

- `NoteEditor` owns Tiptap, HTML changes, and counts cached by immutable document identity. Targeted subscriptions avoid full-document serialization on selection-only changes. Mounted field instances preserve selection/history across theme, status, and ordinary acknowledgements.
- `NoteWriting` coordinates title/body focus and one active-field toolbar. Title Enter focuses the body. Modal/full-page handoff preserves the draft without a navigation-triggered write. Mobile uses full-page editing; desktop retains modal/full-page choice.
- Full view has a separate navigation header and sticky body toolbar. Measured untransformed header height starts the navigation handoff before docking; docking independently controls shadow/corners. Mobile fullscreen controls are hidden. Reduced motion removes the transitions.
- Toolbar: bold, italic, underline, highlight, undo/redo, headings 1–6, lists, quote, inline/block code, strike, HR, and clear marks/blocks. Wider desktop containers expose more controls; narrow/mobile layouts group secondary actions. Existing hard-break, list behavior, and undo grouping remain unchanged.
- `useNoteSession` delegates to `NoteSyncSession`; Zustand holds active memory and Dexie holds recovery. Background saving does not block typing. Explicit leave/Trash operations may block it. Ordinary acknowledgements never replace editor content; recovery, reconciliation, and explicit resolution may. See [autosave](autosave.md) and [conflicts](conflicts.md).
- Rich HTML titles/bodies remain authoritative. No storage-format rewrite, collaboration, encryption, or generic editor framework is included. Appearance persistence is separate from recovery.

Entry points: [create](../../components/note/note-create.tsx), [dialog](../../components/note/note-dialog.tsx), [full view](../../components/note/note-full-view.tsx), [modal](<../../app/[locale]/(note)/eton/@modal/(.)[id]/note-detail-modal.tsx>), [read-only renderer](../../components/note/trash/note-read-only.tsx).

## Upgrade compatibility

Phase 0 upgraded all six direct and resolved Tiptap packages from 2.27.3 to 3.32.0 (commit `f9a7d58`, 2026-10-26); Floating UI DOM 1.8.0 was the v3 menu dependency. These are recorded upgrade versions, not a claim about today's latest release.

- v3 menus import from `@tiptap/react/menus`; obsolete `tippyOptions` were removed. An unnecessary inline Floating UI options override caused a render loop and was removed.
- Current editing and read-only schemas retain paragraphs, headings 1–6, blockquotes, lists, code blocks, HR, hard breaks, text/document, bold, italic, underline, strike, inline code, and highlight. Link, ListKeymap, and TrailingNode remain disabled. Underline was enabled in Phase 1 with Mod+U and `<u>` output.
- Client boundaries and `immediatelyRender: false` remain. Phase 1 superseded Phase 0's transaction-wide rerender subscription with targeted state/count updates. Phase 2 superseded save-on-close-only persistence.
- Shared prose makes nested `pre code` backgrounds transparent, correcting the earlier code-block contrast issue for neutral and colored notes.
- HR at a nonempty paragraph's end uses a scoped command: insert after that text block, reuse/add the following paragraph, and place the cursor there. Other selection cases retain the upstream command; HTML/history behavior is unchanged.

Before another upgrade, consult current Context7/local Next.js documentation, inventory extensions/renderers, and verify representative existing HTML before writes. Keep originals recoverable; do not silently strip unsupported content or save solely because a document opened. Review HTML/URL safety separately from dependency compatibility.

## Security assessment record

Historical registry audits on 2026-10-26/27 dropped production advisories from five to four, with none in Tiptap afterward. They were not a clean production audit and were not rerun during the comparison-layout work.

| Dependency at audit | Finding/result |
| --- | --- |
| Tiptap core 2.27.3 → 3.32.0 | [GHSA-cp6q-959q-f8rh](https://github.com/advisories/GHSA-cp6q-959q-f8rh) addressed; patched ≥3.30.4. Registry severity moderate, upstream high. |
| Tiptap Markdown path | [GHSA-j95f-988m-3j2f](https://github.com/ueberdosis/tiptap/security/advisories/GHSA-j95f-988m-3j2f) fixed in 3.30.5; this HTML-only integration does not use that path. |
| Transitive Zod 4.1.11 via Vercel functions/OIDC/CLI config | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), high; patched ≥4.6.6. Unresolved in that audit; direct app Zod was 4.6.7. |
| Undici 7.29.1 via AI SDK provider-utils | [EventSource memory exhaustion](https://github.com/advisories/GHSA-4qv8-2p9j-2685), [integrity handling](https://github.com/advisories/GHSA-f72v-6w45-q472), [content-encoding handling](https://github.com/advisories/GHSA-xjj6-f33q-929c): two moderate, one high; patched ≥7.30.1, unresolved in that audit. |

No app-specific exploit was demonstrated. The Tiptap attribute issue requires attacker-controlled attribute objects; configured extensions load HTML without custom attribute-object input. A separate existing boundary remains: `NoteCardSummary` inserts stored HTML with `dangerouslySetInnerHTML`, while note validation checks strings/lengths rather than sanitizing HTML. The upgrade does not prove arbitrary stored HTML safe. Historical peer checks reported ESLint 10/plugin range conflicts, with no Tiptap peer conflicts.

## Acceptance evidence

Recorded 2026-10-27/28; later persistence checks in [handoff](handoff.md) supersede earlier save-on-close limits.

- Final lint/types, elevated Next.js/Serwist builds, five mutation/policy regressions, and seven HR-command regressions passed. Run HR cases with `node --import tsx --test scripts/note-editor-commands.test.ts` (EOL, following paragraph, heading, quote, adjacent HR, middle, empty).
- Independent reviews PASS within scoped EN/VI modal/full-page/Trash coverage: desktop 1440×1000, mobile 390×844, targeted 320×844; Paper & Ink/light and Bookish/dark. Representative rich title/body HTML, underline/highlight, headings, nested lists, ordered-list starts, code, hard breaks, HR, and clipboard paste survived save/reopen; Trash remained read-only.
- Corrected footer clearance prevents Scroll to top covering note actions. Failed saves retain editable fields and enabled formatting without refocus. Modal→full handoff observed zero POSTs; repeated close produced one successful request in the reviewed flow.
- Theme changes, background autosave, and server-ID acquisition preserved observed editor/DOM identity, focus, selection, and undo. HR-only notes with blank titles saved/reopened exactly. Title 255/body 21,845 boundaries rejected extra input, including real keypress checks.
- Corrected HR outputs: EOL `<p>Hello</p><hr><p></p>` cursor 9; middle `<p>He</p><hr><p>llo</p>` cursor 6; empty `<hr><p></p>` cursor 2. Undo/redo and focus passed.
- Focused handoff review PASS at 1440×450, 390×450, and 390×844: desktop handoff/docking at scroll 140/204; mobile 124/188, with 56px mobile toolbar. No lingering obstruction/oscillation or horizontal overflow; Back was 40×40 with 2px focus. Reduced-motion transitions were `none`.
- Code contrast after correction: Paper & Ink/light 15.21:1 neutral, 8.50:1 blue; Bookish/dark 15.46:1 neutral, 8.08:1 blue. Mobile controls measured 40×40. Representative long-note smoke reached 19,005 characters; tool timing is not a latency benchmark.
- Owner confirms Vietnamese IME works as before and accepts HR behavior. This is smoke coverage, not an exhaustive input-method/browser matrix. Existing undo granularity is intentionally unchanged; revisit only with evidence and agreement.
- Earlier dedicated QA fixtures were restored or moved to recoverable Trash; unrelated notes were preserved and review browsers closed. Physical touch/keyboard/safe areas, actual fullscreen, exhaustive appearances, production corpus compatibility/performance, and the white draft-card report remain limited/open as recorded in handoff.

## References

[Tiptap migration](https://tiptap.dev/docs/guides/upgrade-tiptap-v2), [HTML/JSON output](https://tiptap.dev/docs/guides/output-json-html), [optional Simple Editor inspiration](https://tiptap.dev/docs/ui-components/templates/simple-editor). References do not authorize replacing the application's design system.
