# All notes and search

## 1. Paginate All notes

Use TanStack Query to fetch owner-scoped cursor pages in the existing newest-first order, with note ID breaking ties on creation time. Fetch bounded card previews on the list and the full document when opened. Fetch the next page near the end of the list and provide an accessible load-more action with retry.

Verify page boundaries with identical timestamps and failed requests. A browser draft can belong to a saved note on a later page. Resolve its identity independently of which pages are loaded so the draft opens the correct editor, contributes to the review filter, and appears once when its page arrives.

## 2. Render long masonry lists

Use native CSS masonry wherever supported. Align the stylesheet and the feature check with the supported syntax, including `display: grid-lanes`. Replace or adapt the existing masonry hook as needed. Use TanStack Virtual's measured lanes as the JavaScript fallback.

Prototype native windowing with measured page spacers. Compare against continuous native masonry on a long list before adopting page-level windowing, since a tall final card in one page can leave gaps above the next. Verify mounted card count, keyboard focus across page boundaries, resizing, and scroll restoration after closing a desktop dialog or returning from the mobile editor.

### Phase 2 implementation and measurements

The collection prefers `display: grid-lanes`, then the older `grid-template-rows: masonry` syntax, with matching stylesheet and feature checks. Unsupported browsers use TanStack Virtual measured lanes. Source order stays unchanged; focused cards, their immediate neighbours, and the editor return target stay mounted. Collections of up to 72 cards retain ordinary rendering and list transitions. Larger collections mount card bodies near the viewport. Collection scroll corrections use immediate scrolling because the application's smooth scrolling otherwise competes with measurement updates.

Native page spacers were rejected after a real WebKit comparison: 240 cards in three lanes, with a 700px final card per 24-card page and 100px other cards, occupied 11,664px in continuous masonry and 15,120px in separate page grids. Page boundaries added 3,456px overall; the first next-page card started 584px later. Individual measured shells preserved continuous native positions with 0px drift in that prototype. The implementation therefore retains native per-card shells and windows their contents rather than separating network pages into grids. Shells have cached or estimated heights and are hidden from accessibility APIs while empty. Native shell/observer count remains proportional to loaded notes; expensive card contents are bounded by the viewport. TanStack retains layout metadata for all loaded items while bounding mounted cards.

Installed browser probes on 2026-11-08: Chromium 158.0.8127.18 and Firefox 159.0 supported neither native syntax; Playwright WebKit 27.2 supported `grid-lanes`. At 240, 480, and 960 loaded notes, top-of-list mounted card-body counts were respectively 16/16/16 in Chromium and 12/12/12 in native WebKit (an earlier run measured 20/20/20) at the desktop test viewport. A mixed-length 480-note Chromium collection had 38 mounted cards, 20 visible cards, and no overlapping cards in a deep-scroll sample. Native Windows WebKit exercises the native implementation, but does not establish physical Safari/iOS momentum-scroll or device behavior. Its default sequential-focus policy skipped hyperlinks even with Alt-Tab; native tests verify source-order button traversal across network-page boundaries and programmatic link focus/return. Full keyboard link traversal in Safari remains a device/browser-preference check. Chromium and Firefox tests traverse links and buttons with ordinary Tab. Offscreen native shell heights are estimates until measured; measurements and editor-return layout caches live only within the signed-in collection provider.

The reproducible native comparison is `node scripts/masonry-prototype.mjs` (requires installed Playwright engines). Targeted browser regressions live in `scripts/browser/note-masonry.spec.ts`, alongside the pagination, browser-work, and transition suites. They use disposable local accounts/databases; no normal app database is migrated or seeded for phase 2 verification.

## 3. Search the collection

Search titles for all active notes owned by the user, plus visible body text for unencrypted notes. Titles remain plaintext. Encrypted bodies are searchable by title only in this plan. A complete on-device body index would require downloading and decrypting the collection on each new device and protecting any persistent index. Revisit that cost if title search proves insufficient.

Search across unloaded pages and reconcile results with browser drafts using the same version shown on the card. Benchmark PostgreSQL trigram indexing on representative long notes. Test mixed scripts, text without spaces, short queries, symbols, and words split by inline formatting. When a body becomes encrypted, remove derived plaintext search data and snippets. Reconcile the public privacy description with the intended encryption behavior before shipping search.
