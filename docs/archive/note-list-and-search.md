# All notes and search

**Status (2026-11-09):** Complete and archived. Pagination, masonry windowing, and collection search are implemented; the refined UI is accepted. The owner confirmed production is working and search works correctly on 2026-11-09. This is owner-reported functional confirmation, not an independent production migration or backfill audit.

The owner deferred the public privacy-page update until the encryption feature goes live; it is no longer a search release blocker. The storage boundary and follow-up remain recorded below. Intermediate UI iterations and detailed probes remain in Git history.

## Collection contract

- Owner-scoped cursor pages sort newest first, with note ID breaking creation-time ties. List responses contain bounded previews; opening a note fetches its full document. Near-end loading includes an accessible load-more/retry action.
- Browser drafts resolve their saved identity independently of loaded pages, open the correct editor, participate in review filtering, and appear once when their page arrives.
- Masonry prefers native `display: grid-lanes`, then `grid-template-rows: masonry`, with TanStack Virtual measured lanes as fallback. Up to 72 cards retain ordinary rendering and list transitions; larger collections window expensive card bodies. Focused cards, immediate neighbours, and editor return targets stay mounted in source order.
- Native masonry keeps measured or estimated per-card shells, hiding empty shells from accessibility APIs. Shells/observers and fallback layout metadata still grow with loaded notes. Caches stay in the signed-in collection provider. Resize preserves the selected-item anchor; scroll corrections are immediate.
- Keep continuous masonry: page-level grids/spacers produced substantial vertical drift in the native prototype. Reproduce with `node scripts/masonry-prototype.mjs`.

## Search contract

- Search covers all active owned notes, including unloaded pages: titles and visible body text for unencrypted notes; title only when `isEncrypted` is true. Trash is excluded. Encrypted-body search is outside this implementation.
- Matching uses case-insensitive literal substrings, Unicode NFC equivalence, and normalized whitespace. Accents and symbols remain meaningful; inline text stays adjacent while blocks/line breaks separate text. There is no tokenizer, fuzzy matching, or minimum query length; queries are limited to 256 UTF-16 code units.
- Authenticated POST bodies carry terms, without adding them to note URLs or a persistent local index. Pages return at most 24 results, PostgreSQL-microsecond creation-time/ID cursors, and bounded plain-text snippets. Search results are never editor baselines.
- `note_search_documents` stores canonical visible text separately from HTML. Note writes and projections commit together. Source-change triggers invalidate stale projections; encryption transitions and write guards clear derived body text. Encrypted search hits and ordinary list/identity previews contain no body. Backfill preserves note revisions/content; theme edits and idempotent acknowledgements reuse projections.
- Reconciliation matches the exact displayed version: a draft can add a match or suppress a stale server hit; ambiguous hidden versions stay excluded. Saved acknowledgements expire after newer successful authoritative queries, including absence. Query/review-filter state survives dialog and mobile editor return.

## Interaction contract

- Input updates immediately; requests debounce for 300ms and wait for IME composition. Previous results and empty states remain visible until the latest query succeeds; errors retain them with retry/refresh. Successful replacements and clearing use the note-list ViewTransition while retaining shared card/list identity. Pagination waits for search to settle.
- The loading indicator appears after 150ms of actual fetching, stays at least 300ms once shown, and has a localized screen-reader label. Clear keeps input focus; Escape clears, then closes an empty field and returns focus to the search button. Editor-return focus waits for reconciliation.
- The field expands to 320px on desktop and a full row on mobile. New note stays in the desktop toolbar and floats on mobile with a 48px target, safe-area spacing, and final-card clearance. Phone cards use one readable column; filters have 8px gaps. Reduced motion skips transitions.

## Maintenance: migrations and backfill

Use this sequence for new environments or recovery after imports/direct source edits. Never use the normal application or production database for QA fixtures.

1. Verify `DATABASE_URL` and `POSTGRES_URL_NON_POOLING` identify the same intended database. Apply checked-in migrations with `pnpm db:migrate` locally or `pnpm db:prod:migrate` for production. The search migration requires permission to enable `pg_trgm`.
2. Deploy projection-maintaining writers. Missing active-note documents produce `503` with `code: search_not_ready`, offering retry/Clear instead of false no-results; ordinary notes remain available.
3. Run `node --env-file=.env.local --conditions=react-server --import tsx scripts/backfill-note-search.ts`, substituting the explicit environment file for the target. Resumable batches lock at most 50 notes, fill missing documents, and serialize with writes. Require the final zero-missing-documents assertion. Imports/direct edits can require another backfill.
4. Verify an older off-page match and a title-only encrypted fixture whose body never appears in results.

## Encryption follow-up

The [privacy page](../../app/[locale]/trust/privacy/page.tsx) claims automatic server encryption of note titles/bodies in two passages. The audited application stores title/content as text, defaults `isEncrypted` to false, and has no note encryption/decryption transform or editor control. The flag currently enforces search exclusion; infrastructure/storage/transport encryption was not established by this audit.

**Owner decision (2026-11-09):** Leave the privacy page unchanged for this release and update it when the encryption feature goes live. Revisit the search projection lifecycle and encrypted-body search scope with that feature. Clearing projections does not establish erasure from historical WAL, backups, or old MVCC versions.

## Verification and limits

- Backend: `node --env-file=.env.local scripts/run-note-search-tests.mjs` creates, migrates, and drops its own disposable loopback database.
- Client: `node --import tsx --test scripts/note-search-client.test.ts`.
- Browser: `scripts/browser/note-search.spec.ts`, `note-list-transitions.spec.ts`, `note-pagination.spec.ts`, and `note-masonry.spec.ts`. App and search runner must share a dedicated loopback database whose name contains `_test`; see the [editor testing guide](note-editor/testing.md).
- [Benchmark report](../../scripts/note-search-benchmark-results.json): 12,000 synthetic notes across four owners. Selective trigram queries improved substantially; common terms can remain slower. Short/symbol queries use owner-only scans. Search storage was about 278 MiB versus 89 MiB for source notes. These local warm-cache measurements are not production guarantees.

Recorded on 2026-11-08: 41 backend regressions and eight client tests passed; final Chromium UI coverage passed 15 search and two list-transition cases. Baseline pagination/masonry passed 10 Chromium cases; WebKit passed 11 search and three native masonry cases before later UI refinements. Backfill passed zero-missing and idempotent-rerun checks. Lint, TypeScript, production build, formatting, migration consistency, and diff checks passed. Toolbar/FAB visual review passed desktop/mobile, EN/VI, light/dark, and coarse-pointer checks; later timing/retention changes used browser regressions without another design review, as requested.

On 2026-11-09, all eight client tests passed again, and the owner confirmed production/search operation. No production database audit or new browser suite was performed for documentation closeout. Physical Safari/iOS momentum scrolling, every appearance/browser combination, and infrastructure encryption remain outside recorded verification; WebKit was not rerun for the final UI refinements. QA fixtures used disposable databases and temporary servers/databases were removed.
