# Account data actions

**Status (2026-10-25):** Implementation complete and accepted by the owner. Archived as the feature contract and local validation record. Production deployment and the real Google end-to-end flow are not verified here. Visual rules remain in [DESIGN.md](../../DESIGN.md).

## Product contract

- Settings → Account contains two separate actions, localized in English and Vietnamese.
- **Move all notes to Trash** moves all active notes, including archived notes, to the existing 30-day recovery lifecycle. Existing Trash deadlines (including expired rows awaiting cleanup) are unchanged. The account and preferences remain. The confirmation shows a fresh active count; completion reports the actual affected count. No active notes disables the action.
- **Delete account** permanently removes the profile, all owned notes in every lifecycle state, saved account appearance, and feature grants in one database transaction. Shared AI research records remain untouched. The normal account UI does not mention AI.
- Account deletion requires a new Google OAuth round trip for the same account, followed by typing the exact email. The email is highlighted in both steps. The dialog explains that deleting this app account does not affect the Google account. Verification itself never deletes data.
- Verification expires five minutes after the successful Google callback. Refresh preserves the original timestamp; `?confirmDelete=1` only reopens the dialog. An expired dialog returns to Google verification, and the server independently refuses deletion.
- Re-registering with the same Google email creates a new internal user ID and empty account. Old sessions cannot attach to it.
- Restore all, Empty Trash, exports, and an account recovery period are outside this change.

The Clear your notes section uses a trash-bin action icon and always shows View Trash beside the active count. Its green completion message stays inside that section, above the account-deletion divider. It has no timeout; it clears on full reload or when starting another bulk move, and may persist across client navigation.

## Authentication and consistency

JWTs carry the internal immutable user ID. Every server-side session check verifies that ID using an uncached database lookup. Legacy email-only sessions must sign in again once after rollout. Client session updates cannot supply a verification timestamp or change the authenticated ID.

Starting account deletion creates a short-lived, encrypted, HttpOnly intent cookie bound to the original ID and email. The existing Google provider performs the OAuth round trip with account selection, `max_age=0`, PKCE and state checks. The callback rejects an account mismatch without creating or switching accounts. A matching callback consumes the intent and records the verification time in the encrypted session JWT. No new Google callback URI is required.

The DELETE API checks authentication, same origin, fresh server-issued verification, exact email confirmation, and the ID of the account whose settings were displayed. Bulk Trash and verification initiation also reject an account switch since rendering.

Client action error handling rethrows Next.js routing signals before showing application errors. A normal Google redirect must not flash the verification-unavailable message; genuine startup failures still show it.

Interactive note writes and both destructive operations lock the owner's user row in a transaction. Saves cannot revive trashed notes; writes using a deleted ID are refused. Account deletion rolls back entirely on failure. Cache invalidation happens after commit and does not change a committed operation into a reported deletion failure.

Successful operations notify other tabs in the same browser. Bulk Trash refreshes open views and discards unsaved drafts, as disclosed in the dialog. Account deletion clears that account's local appearance queue and sends open tabs to the public confirmation page. Server enforcement remains effective when browser storage events are unavailable. Account, auth and note responses bypass service-worker caches; activation removes matching legacy entries.

Implementation entry points: [account repository](../../db/repositories/account.ts), [server actions](<../../app/[locale]/settings/account/actions.ts>), [deletion API](../../app/api/user/account/route.ts), [authentication](../../auth.ts), and [settings UI](../../components/settings/account-actions.tsx). The [note recovery contract](../note-recovery-trash.md) defines individual Trash operations and cleanup. No schema migration is required.

## Validation record and limits

- Local account/note regression suite: 33 tests passed. HTTP integration: one test passed, covering authentication, origin, expiry, exact email, account-switch refusal, forged session updates, deletion, and old-session rejection after same-email registration.
- Lint/type checks and production build/service-worker generation passed during implementation. EN/VI desktop/mobile and light/dark UI review passed; subsequent visual refinements were accepted by the owner without another reviewer.
- Google handoff regression check passed with the external destination intercepted: no dialog error appeared before navigation. A simulated failed action still showed the verification-unavailable message. The highlighted first-step email rendered as selectable text.
- Related note-dialog checks passed after clearing accumulated dev rewrites and adding cached-dialog cleanup: repeated open/Back/Forward, Escape/close, focus containment/restoration, and refresh to the full-page editor. No existing notes or accounts were deleted during visual review.

**Unverified:** complete real Google sign-in through the email-confirmation screen, wrong-account and cancellation behavior, and full browser account deletion/re-registration. Use a disposable Google-backed app account for those checks. Cross-tab completion behavior and the zero-active-note browser state were not exercised in review. Owner acceptance does not establish production deployment or these checks.

## Local checks

`pnpm test:account` loads `.env.local`, requires a loopback PostgreSQL instance, creates its own uniquely named disposable database, runs migrations and the account/note suites, then drops only that database. The configured local database user needs permission to create databases.

With the development server running, set `ACCOUNT_TEST_ORIGIN=http://localhost:3000` and run `pnpm test:account:http`. Both the origin and database must be local. This creates only uniquely named temporary fixture accounts in the development database and removes them in cleanup. It never deletes an existing user or modifies the QA account. Fixture JWTs exercise the real HTTP authentication/session/deletion path; they do not test Google's external UI.

Visual QA uses the existing development-only `qa@test.dev` credentials provider described in [AGENTS.md](../../AGENTS.md); never delete that account or bulk-trash its notes during review. The QA provider does not grant account-deletion verification.
