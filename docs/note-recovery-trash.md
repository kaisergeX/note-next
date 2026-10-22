# Note Recovery and Trash — Feature Plan

**Status:** proposed on 2026-10-22; implementation has not started. The defaults below are recommendations for review, not existing behavior. This feature belongs to notes; AI rate limiting remains separate and deferred.

## Outcome and scope

Deleting a saved note moves it to Trash so its owner can recover it for 30 days. The owner can inspect it without editing, restore it, or permanently delete it earlier. Normal note links and editors cannot read or modify trashed notes.

First release includes individual actions and automatic expiry. Bulk selection, Empty Trash, search, configurable retention, version history, archive management, offline mutation queues, account deletion, and recovery of notes already permanently deleted are outside this scope.

## Existing implementation

- [Schema](../db/schema/notes.ts): `pendingDeleteAt` / `pending_deleted_at` already exists as a nullable timezone-aware timestamp. `isArchived` is independent; there is no trash UI or cleanup job in the inspected flow.
- [Database helpers](../db/helper/notes.ts): `deleteNote` permanently deletes a row. `getListNote` includes every row belonging to the owner. `getNote` checks ownership through email but does not check deletion state. `updateNote` and `deleteNote` filter only by note ID, so authentication alone does not enforce ownership for mutations.
- [Actions](../app/[locale]/(note)/eton/actions.ts): create accepts a caller-supplied author ID; edit filters fields by exclusion. The recovery work must derive ownership from the authenticated database user and explicitly allow editable fields rather than copying lifecycle fields from client state.
- [Cache helpers](../db/helper/index.ts): list tags use email and detail tags use note ID. `getCachedListNote` currently passes email into a helper expecting a user ID; correct this if retained. Cached detail entries must also include authenticated identity in their cache arguments.
- Deletion entry points are [note cards](../components/note/note-tiny.tsx) and [editor controls](../components/note/note-customize.tsx). Both the [full editor](../app/[locale]/(note)/eton/[id]/note-detail.tsx) and [modal editor](../app/[locale]/(note)/eton/@modal/(.)[id]/note-detail-modal.tsx) save on exit; neither should save again after moving a note to Trash.

## Proposed behavior

| Action or view | Result |
| --- | --- |
| Move to Trash from a card | Hide the saved note from Notes after the server confirms success. No confirmation dialog is needed for this recoverable action. |
| Move to Trash from an editor | Save the current validated title/body/theme and move the note in one atomic operation. On success, clear editor state and close to Notes without invoking save-on-close again. On failure, keep the editor and its draft. |
| Open Trash | Authenticated owner sees recoverable notes, most recently trashed first, with title/excerpt, expiry date, and Restore/Delete permanently actions. Include an empty state and Back to Notes. |
| Open a trashed note | Use a dedicated read-only preview within Trash. No editor, autosave, or customization controls. Preserve existing note-hue and safe rendering rules. |
| Restore | Clear the deletion deadline; keep the same ID, content, theme, archive flag, and creation date. Return it to the existing Notes behavior; do not force-open an editor. |
| Delete permanently | Require an accessible confirmation naming the note (with an untitled fallback) and explaining that it cannot be recovered. Delete only an owned, still-trashed note. |
| Open an ordinary link to a trashed, expired, absent, or another owner's note | Show the same unavailable/not-found result without exposing content or ownership. Cover modal, normal, and `/full/eton/[id]` entry points. |
| Network/server error | Keep the item or draft visible, report a localized error, and allow retry. No success message until the server commits. Offline mutation queuing is not introduced. |

Add a Trash link beside the Notes page controls, including its empty state, so it remains discoverable after the last note is removed. Add the same authenticated destination to desktop and mobile navigation. All links, messages, dates, confirmation text, and statuses support English and Vietnamese. Use a restrained list and the existing Paper & Ink tokens/primitives defined in [DESIGN.md](../DESIGN.md).

## Data lifecycle and authorization

Reuse `pendingDeleteAt` as the **scheduled permanent-deletion deadline**, not the time the note entered Trash. Existing null values remain active; no content migration or physical column rename is needed. Before enabling cleanup, audit any existing non-null values: their previous meaning is not established by the current helpers, so do not purge them blindly.

| State | Database predicate | Allowed operations |
| --- | --- | --- |
| Active | Deadline is null | Normal read/edit, move to Trash |
| Recoverable | Deadline is later than database time | Trash read/preview, restore, permanent delete |
| Expired | Deadline is at or before database time | Cleanup only; no read/edit/restore |

- On the first active-to-trash transition, set the deadline to database time plus exactly 30 × 24 hours. Repeat requests must not extend retention. Display the expiry as a localized date/time; the server clock decides eligibility.
- Every user query/mutation includes `authorId = userInfo.id` from `requireAuth()`, the note ID when relevant, and the expected lifecycle state. Never accept ownership or deletion timestamps from the client. Validate IDs and editable content server-side. Apply the same owner derivation to create and existing edit actions while touching this boundary.
- Generic edits must reject lifecycle fields and cannot update trashed rows. Restore and permanent delete use an expected deadline from the displayed trash item as a conditional token; an old request cannot affect a newer trash cycle. Retry results should distinguish an already-completed operation from a conflict without revealing another owner's row.
- Use atomic conditional writes and inspect affected rows; do not authorize with a read followed by an unconditional write. Concurrent edit/trash, restore/purge, and repeated actions must leave one valid lifecycle state. A stale editor save after trash must fail rather than recreate or change the trashed note.
- Preserve note content and metadata on lifecycle changes. The existing database `updated_at` trigger can advance `updatedAt`; document that this represents row modification, not exclusively content edits. Do not add a second deletion flag or mix this with `isArchived`.
- Add indexes for owner-scoped trash ordering and due-expiry cleanup, using the nullable deadline. Review the generated migration against the actual data distribution before adding redundant indexes.

## Routes, cache, and cleanup

- Proposed pages: `app/[locale]/(note)/trash/page.tsx` and `trash/[id]/page.tsx`. These sit outside `eton`'s parallel modal layout; the preview renders read-only content. Register `/trash` in [protected route configuration](../config/auth.ts) and authenticate pages and actions independently.
- Keep lifecycle actions together with the existing note actions, backed by explicit owner-scoped database helpers. Use structured localized outcomes for success, unavailable/conflict, validation failure, and retryable failure.
- Invalidate the active-list, trash-list, and note-detail tags after every successful lifecycle mutation; content edits invalidate relevant detail/list entries. A restored note cannot reuse a stale unavailable/detail result. Deadline-sensitive trash reads and ordinary note visibility checks must not rely on an indefinitely cached pre-expiry state; enforce current eligibility before serving cached content.
- Refresh on focus/visibility return and at the nearest displayed expiry so an already-open Trash page removes expired items and refreshes stale actions. Fresh reads reconcile other-tab changes; realtime subscriptions are unnecessary.
- Audit [service-worker behavior](../app/sw.ts) for authenticated note HTML/RSC responses and any new endpoints. Verify offline navigation cannot present cached content as current/recoverable or report a successful mutation. Do not persist note bodies or trash mutations in the appearance store.
- Implement a shared server-only cleanup routine, invoked by a deployment-scheduled job once daily. Process bounded batches of rows whose non-null deadline is due, recheck the predicate in each delete, and invalidate affected owner/list/detail caches. Make retries and overlapping invocations safe; log counts and failures without note bodies.
- The scheduler entry point uses a dedicated secret, rejects unauthorized invocations before database work, and is excluded from service-worker caching. Deployment scheduler/provider configuration is an implementation prerequisite to resolve; no scheduler configuration was found in this repository inspection. Do not claim automatic deletion until the deployed job is enabled and verified.
- Recovery ends at the deadline even if physical cleanup is delayed. UI copy should say “Recover within 30 days”; physical removal happens on the next successful cleanup run. If cleanup fails, retain rows, report the job failure, and retry on the next run.

## Delivery sequence

1. **Data and mutation boundary:** audit existing deadlines, define the retention constant, add indexes/migration, owner-scoped helpers, explicit edit/create payload validation, and atomic lifecycle operations. Add database integration coverage before replacing hard deletion.
2. **Replace deletion:** update cards and both editor variants to Move to Trash. Preserve unsaved editor content atomically, avoid the second save-on-close, and invalidate active/detail/trash caches. Handle failures and repeat requests.
3. **Trash experience:** add the list, read-only preview, restore, confirmed permanent deletion, navigation, EN/VI text, pending/error/empty states, and deadline refresh. Apply normal-route unavailable behavior for trashed notes.
4. **Expiry and deployment:** wire the authenticated scheduled cleanup, bounded batches, cache invalidation, and job failure reporting. Verify retention boundaries, overlapping runs, and the configured deployed schedule.
5. **Review and closeout:** run the focused checks below, update this document with evidence and accepted limits, and mark the roadmap complete only after implementation and cleanup deployment are working. Keep one active plan file; archive it as a descriptive standalone document when complete unless additional durable documents justify a feature folder.

## Acceptance and verification

- Database integration tests with two owners: forged create ownership, cross-owner read/edit/trash/restore/delete, invalid IDs/payloads, and attempts to write lifecycle fields through generic editing.
- Lifecycle tests: content/metadata preservation, repeated trash without extending the deadline, restore and re-trash, stale deadline tokens, concurrent save/trash and restore/purge, and no mutation of an active note through permanent-delete actions.
- Clock-controlled boundary tests: just before, exactly at, and after expiry; delayed cleanup; batch size limits; repeat/overlapping job execution; unauthorized job invocation; legacy non-null deadline handling.
- Cache tests: prime active/detail/trash entries before each transition and before expiry, then verify the owner sees fresh results and another account cannot reuse them. Check ordinary/modal/full links after trash and permanent deletion.
- Browser review: card deletion; edited draft → trash → preview → restore in both editor variants; confirmation cancel/confirm; last-note and empty-trash states; request failure/retry; focus/expiry refresh; desktop/mobile navigation; offline and reconnect behavior.
- Run `pnpm lint` and `pnpm build` after implementation. Follow `ui-build` and its required `ui_reviewer` review for UI changes, including EN/VI, keyboard/focus behavior, mobile widths, and representative preset/mode coverage. Provision the existing QA user through the owner if missing; never grant access independently.

No application code, database rows, retention policy, or deployed cleanup schedule has changed as part of this planning task.
