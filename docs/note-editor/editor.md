# Editor rebuild

Status: design pending. See [overview](overview.md) for accepted scope and delivery order.

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

## Security evidence, not a completed audit

The inspected lockfile resolved `@tiptap/core` 2.27.3. [GHSA-cp6q-959q-f8rh](https://github.com/ueberdosis/tiptap/security/advisories/GHSA-cp6q-959q-f8rh) lists that line within its affected range and 3.30.4 as patched. App-specific exploitability was not established. A production dependency audit stalled and was stopped; no clean audit result exists.

Do not treat 3.30.4 as the target recommendation: later advisories exist, including [GHSA-j95f-988m-3j2f](https://github.com/ueberdosis/tiptap/security/advisories/GHSA-j95f-988m-3j2f), which lists a 3.30.5 fix for a separate Markdown parser issue. Recheck current advisories and resolved transitive dependencies at implementation time.

## Design decisions to settle

- Toolbar placement, selection menu, keyboard shortcuts, and mobile controls.
- Which current controls are essential versus redundant; preserve content compatibility even if controls move.
- Exact title formatting/Enter behavior and existing length constraints.
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
