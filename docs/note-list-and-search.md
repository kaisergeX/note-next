# All notes and search

**Status (2026-11-08):** Pagination, masonry windowing, and collection search are implemented; the refined UI is accepted. Keep this document active until the release checks below are closed.

## Release closeout

- [ ] Confirm migrations and a completed search-document backfill on the intended deployment database using the rollout sequence below. Local disposable-database verification does not establish deployment readiness.
- [ ] Reconcile the public privacy page's encryption claims with the actual storage behavior before shipping search. See the privacy boundary below.
- [ ] After release closeout, move this document to `docs/archive/`, repair relative links, and update the README link. Git history retains the intermediate UI iterations.

## Collection and masonry

All notes uses owner-scoped cursor pages, newest first, with note ID breaking creation-time ties. List responses contain bounded previews; opening a note fetches its full document. Near-end loading has an accessible load-more/retry action. A browser draft's saved identity is resolved independently of loaded pages, so an off-page draft opens the correct editor, participates in review filtering, and appears once when its page arrives.

The collection prefers native `display: grid-lanes`, then the older `grid-template-rows: masonry` syntax. Unsupported browsers use TanStack Virtual measured lanes. Source order is preserved; focused cards, their immediate neighbours, and the editor return target stay mounted. Collections up to 72 cards retain ordinary rendering and list transitions. Larger collections bound expensive card bodies to the viewport. Scroll corrections are immediate to avoid competing with application smooth scrolling.

Native masonry retains measured or estimated per-card shells and windows their contents. Empty shells are hidden from accessibility APIs. Native shell/observer count remains proportional to loaded notes; TanStack also retains layout metadata for loaded items. Measurement and editor-return caches live only in the signed-in collection provider.

Page-level native spacers were rejected: in a 240-card, three-lane WebKit prototype with one 700px final card per 24-card page and 100px other cards, continuous masonry occupied 11,664px versus 15,120px for separate page grids. Page boundaries added 3,456px; the first next-page card started 584px later. Individual measured shells preserved continuous positions with 0px drift.

Recorded probes on 2026-11-08 found neither native syntax in Chromium 158.0.8127.18 or Firefox 159.0; Playwright WebKit 27.2 supported `grid-lanes`. At 240/480/960 loaded notes, top-of-list mounted card-body counts were 16/16/16 in Chromium and 12/12/12 in WebKit at the tested desktop viewport. A mixed-length 480-note Chromium collection had 38 mounted cards, 20 visible cards, and no overlapping cards in a deep-scroll sample. Counts vary with content and viewport; offscreen native heights remain estimates until measured.

Reproduce the native comparison with `node scripts/masonry-prototype.mjs` and installed Playwright engines. Pagination/masonry regressions live in `scripts/browser/note-pagination.spec.ts` and `scripts/browser/note-masonry.spec.ts`.

## Search behavior and data boundary

Search covers all active notes owned by the user, including unloaded pages: titles plus visible body text for unencrypted notes. Encrypted bodies are excluded and match by title only. Trash is excluded. A future on-device encrypted-body index would require downloading, decrypting, and protecting a local collection index; it is outside this implementation.

Matching uses case-insensitive literal substrings, Unicode NFC equivalence, and normalized whitespace. Accents and symbols remain meaningful. Inline formatting preserves adjacent text; blocks and line breaks separate text. There is no tokenizer, fuzzy matching, or minimum query length. Authenticated POST bodies carry search terms; terms are not added to note URLs or persisted as a local index. Cursor pages use creation time with PostgreSQL microseconds plus note ID, with at most 24 results and bounded plain-text snippets. Search results are never editor baselines.

`note_search_documents` stores canonical visible text separately from note HTML. Note writes and projection updates commit together. Source-change triggers invalidate stale documents; encryption transitions and projection-write guards clear derived body text. Encrypted search hits and ordinary list/identity previews return no body content. Backfilling changes neither note revisions nor editor content. Theme edits and idempotent save acknowledgements reuse existing projections.

Reconciliation evaluates the exact version displayed on each card. A single draft can add a match or suppress an older server hit; ambiguous hidden versions do not become search results. Saved acknowledgements remain temporary overlays until a newer successful authoritative query reconciles them, including when the note is absent. Extracted draft/saved text is memoized. Query and review-filter state stay in the signed-in collection provider across dialog/mobile editor return.

### Search interaction

- Toolbar order: browser-work actions, review filters, then the search icon. The mounted field expands to 320px on desktop and the full row on mobile. Size/opacity and discrete display transitions cover opening and closing; reduced motion skips them.
- Input updates immediately; requests debounce for 300ms after input changes and wait for IME composition to finish. Typing and displayed results use separate queries. The existing list and its empty state stay visible while the next query waits or fetches; only successful results for the latest query replace them through the note-list ViewTransition. Failures preserve the previous list alongside an error. Clearing also transitions back to All notes. Shared cards and the masonry list retain their component identity.
- The loading spark replaces the leading search icon only after an actual request lasts 150ms. Once shown, it stays visible for at least 300ms and through continued pending work, with a localized screen-reader label. There is no extra empty-result timer or routine result count.
- Empty results and errors appear above the collection; failures offer retry or refresh. Pagination controls and automatic next-page requests wait for the current search to settle.
- Clear keeps input focus. Escape clears the query, then closes the empty field and returns focus to the search icon. Input is disabled through hydration. Editor-return markers track the typed query, including when a still-visible note is opened before search finishes; focus restoration waits for reconciliation.
- New note stays in the desktop toolbar and floats bottom-right on mobile, with a 48px target, safe-area spacing, and collection-end clearance. Phone-width note cards retain one readable column. Filters have 8px gaps so their expanded touch targets meet without overlapping.
- Resize preserves the selected-item anchor: measured lanes realign after measurement resets; native masonry retains physical anchor correction.

## Deployment and backfill

Apply this sequence to the intended deployment database. Never migrate or seed the normal application database for QA.

1. Verify `DATABASE_URL` and `POSTGRES_URL_NON_POOLING` identify the same intended database. Apply checked-in migrations with `pnpm db:migrate` locally or `pnpm db:prod:migrate` for production. The search migration requires permission to enable `pg_trgm`.
2. Deploy the writer code that maintains projections. During preparation, missing search documents produce `503` with `code: search_not_ready`; the UI offers retry and Clear instead of false no-results. Ordinary notes remain available.
3. Run the resumable backfill against that same database. Locally: `node --env-file=.env.local --conditions=react-server --import tsx scripts/backfill-note-search.ts`. Use the corresponding explicit environment file in production. Batches lock at most 50 notes, fill only missing documents, and serialize with writes. Restart after interruption; the final assertion must report zero missing documents. Direct SQL imports/source edits invalidate projections and require backfilling again.
4. Verify an older off-page note matches, plus a title-only encrypted fixture whose body never appears in results. Resolve the privacy claim before release.

### Privacy boundary

`app/[locale]/trust/privacy/page.tsx` claims automatic title/body encryption on the server in two passages. The audited application persists title/content as text, defaults `isEncrypted` to false, has no encryption editor control, and contains no note encryption/decryption transform. The flag is a search exclusion boundary, not an encryption implementation. Infrastructure, storage, and transport encryption settings were not established by this code audit.

This work changed neither public policy text nor encryption behavior. Clearing a projection does not promise erasure from historical WAL, backups, or old MVCC versions. The public claim remains an owner release decision.

## Performance evidence

The [benchmark report](../scripts/note-search-benchmark-results.json) uses 12,000 synthetic notes across four owners: 124.4 MiB source HTML and 626 long notes on PostgreSQL 15. Selective trigram queries improved substantially; common words can remain slower. Patterns without extractable word trigrams use explicit owner-only primary-key scans: common short/symbol queries were about 3-4ms, absent queries about 50ms for 3,000 owned notes.

The search table including indexes/TOAST occupied about 278 MiB versus 89 MiB for notes; the body GIN alone was about 105 MiB. These local warm-cache, small-sample measurements are not production latency guarantees. The report also records body-edit, theme-only, idempotent-save, repository-call, and response-size costs.

## Verification and maintenance

- Backend: `node --env-file=.env.local scripts/run-note-search-tests.mjs` creates, migrates, and drops its own disposable loopback database.
- Client: `node --import tsx --test scripts/note-search-client.test.ts`.
- Browser: `scripts/browser/note-search.spec.ts`, `note-list-transitions.spec.ts`, and pagination/masonry suites. Search tests require the app and runner to share a dedicated loopback database whose name contains `_test`. Follow the [editor testing guide](archive/note-editor/testing.md) for fixture authentication and server-origin setup.

Recorded verification on 2026-11-08:

| Scope | Result |
| --- | --- |
| Final retained-result UI | 17 Chromium regressions: 15 search cases and two list-transition cases. Includes real ViewTransition effects, shared card/list DOM identity, retention during debounce/loading/failure, reduced motion, and desktop/mobile editor focus return. |
| Baseline backend and client | 41 database/account/note regressions and eight client reconciliation/request tests passed. |
| Baseline pagination/native coverage | Chromium passed 10 pagination/masonry cases; installed WebKit passed 11 search cases and three native masonry cases. WebKit was not rerun for the later UI refinements. |
| Preparation | Backfill prepared legacy disposable fixtures, asserted zero missing documents, and prepared zero rows on rerun. |
| Static/production checks | Lint, TypeScript, production build, formatting, migration consistency, and diff checks passed. The final UI follow-up reran lint, TypeScript, build, formatting, and diff checks. |
| Toolbar/FAB visual review | PASS at 1440px Paper & Ink light and 390px Bookish dark, including Vietnamese, focus, retry, contrast, overflow, targets, and final-card clearance. Focused coarse-pointer review passed after the filter-gap correction. Subsequent timing/retention changes used browser regressions without another design review, as requested. |

Earlier cases also covered off-page matches, inline/NFC/symbol queries, stale-draft suppression, review filtering, encrypted body exclusion, acknowledgement expiry after external edits, resize, and bounded card bodies through 960 loaded notes. Native Windows WebKit does not establish physical Safari/iOS momentum scrolling. Its sequential-focus policy skipped hyperlinks even with Alt-Tab; native checks covered source-order buttons and programmatic link focus/return, while Chromium and Firefox covered ordinary Tab traversal.

All migration/backfill/QA fixtures used disposable databases; temporary production test servers and databases were removed. The normal database and privacy page were unchanged. Physical-device behavior, all appearance/browser combinations, and deployment infrastructure encryption remain outside the recorded verification. The final UI refinement has no known unfinished implementation work; release closeout remains above.
