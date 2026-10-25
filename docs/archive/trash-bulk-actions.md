# Trash bulk actions and previews

**Status (2026-10-25):** Implemented and locally verified, including final visual review. Extends the accepted [account data actions](account-data-actions.md) and [note recovery](../note-recovery-trash.md) contracts.

## Accepted behavior

- Trash and Account settings show the recoverable-note count. Counts refresh after changes, on focus/reconnect, and at the next expiry; expired notes disappear even offline.
- Restore all confirms the recoverable count and returns those notes to All notes. It preserves content, theme, archive/encryption flags, ID, and creation date.
- Empty Trash confirms the count and requires the exact highlighted phrase `EMPTY TRASH` (EN) or `XÓA THÙNG RÁC` (VI). It permanently deletes the confirmed recoverable notes. Active notes and other accounts are unaffected; scheduled cleanup handles expired rows.
- Trash uses an auto-fill grid based on available container width. It reuses the All notes card surface/summary and shared small icon buttons. The skeleton uses the same grid, card surface, and button sizing.
- Cards open a read-only library Dialog over the existing list. The neutral Read-only badge sits beside Close; expiry reads “Recoverable until {date}” / “Có thể khôi phục đến {date}”. Long content scrolls inside the preview. Restore and confirmed permanent deletion remain available there. The old `/trash/[id]` URL redirects to Trash.
- Successful actions update the list and counts without persistent success text. Dialog titles ask once; body text explains the outcome. Errors remain near their action, with retry and renewed confirmation when needed. Empty/offline controls prevent mutations.
- Account, bulk, and single-note confirmations use the shared confirmation wrapper around `@kaiverse/k/ui`'s Dialog. The library owns visibility and motion. Pending mutations prevent dismissal; idle Escape/Cancel restore focus. Confirmations retain the accepted no-backdrop-dismiss behavior.

## Implementation and isolation

Every [Trash action](<../../app/[locale]/(note)/trash/actions.ts>) authenticates its caller and checks the rendered account ID. Preview reads additionally require an owner-filtered recoverable note with the exact Trash deadline. Missing, foreign-owned, active, expired, and changed-cycle notes return no content.

The [account repository](../../db/repositories/account.ts) serializes writes through the owner's user-row lock. Confirmation previews hash the owner plus ordered note IDs and exact PostgreSQL microsecond deadlines. Added, removed, expired, restored, or re-trashed notes invalidate the confirmation. The [note repository](../../db/repositories/notes.ts) applies one owner-filtered update/delete against matching identities and the database clock. Failed transactions roll back; competing bulk requests have one winner, and old confirmations cannot act on a new Trash cycle.

Cache invalidation follows commit. Cross-tab Trash refreshes preserve unrelated active drafts. Delete-account and Move all notes events retain their existing draft-clearing behavior.

The New note label is selected once in the authenticated server layout, preserving phrase variation while matching initial HTML and hydration. Direct list deletion keeps its card mounted until the server-refreshed list removes the ViewTransition boundary. Modal previews fetch outside page transitions, and preview retries reset state in the event handler.

## Validation

- `pnpm lint`: TypeScript and ESLint passed.
- `pnpm test:account`: 38 tests passed against a disposable local database, including owner isolation, preserved metadata, expiry boundaries, changed snapshots, concurrent mutations, replay rejection, and rollback.
- `pnpm build`: production build and service-worker generation passed.
- HTTP account and note regression checks passed. The legacy Trash detail assertion covers HTTP and streamed redirects.
- Browser checks passed for bulk restore/delete, Account count updates, wrong/exact EN/VI phrase gates, empty-list controls, absence of stale success text, list deletion, and preview retry after a simulated failure.
- Preview boundary checks rejected another account, another owner's note, an active note, and a mismatched deadline without returning note content. Read-only content, internal scrolling, badge placement, footer alignment, nested Escape handling, and focus restoration were exercised.
- Earlier checks covered changed confirmations, cross-tab count updates/draft preservation, matching randomized creation labels on EN/VI loads, reduced motion, and close-during-loading races.
- Final UI review passed at 1440/768/390 widths in Paper & Ink light and Bookish dark across EN/VI Trash and Account settings, with an All notes regression check. Grid/sidebar adaptation, counts, phrase gates, read-only scrolling, badge placement, nested Escape, focus restoration, reduced motion, wrapping, and contrast passed. The lowest measured text contrast was 5.98:1.
- The review found and verified one correction: shared small icon buttons' expanded coarse-pointer hit areas now have zero overlap with card preview targets, using footer spacing in both cards and skeletons. Effective targets remain 40px. Input sizing and toolbar skeletons use shared primitives. Final skeleton sizing was checked in source; the Google-verified email-input branch was not reopened through OAuth.

Browser mutation checks used disposable fixture accounts; existing users and QA notes were preserved. The closeout accounts, notes, temporary fixture file, and helper were removed after validation.

## Remaining scope

No migration is required. Deployment and automatic production cleanup scheduling verification are separate from this local feature closeout; the latter remains tracked in [note recovery](../note-recovery-trash.md). Selection-based bulk actions, export, other browser engines, physical-device testing, and very large Trash-list performance remain outside this implementation.
