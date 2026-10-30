# Browser regressions

`pnpm test:notes:browser` runs Playwright Chromium against a running local app. It does not start a server or migrate a database. The local app database must already have the checked-in migrations applied.

## Run

```sh
pnpm exec playwright install chromium
pnpm dev
```

In another terminal:

```sh
NOTES_TEST_ORIGIN=http://localhost:3000 pnpm test:notes:browser
# Repeat the suite with new accounts/contexts to check stability:
NOTES_TEST_ORIGIN=http://localhost:3000 pnpm test:notes:browser --repeat-each=2
```

The script loads `.env.local`. `NOTES_TEST_ORIGIN` must be a loopback HTTP origin, and `DATABASE_URL` must point at loopback PostgreSQL. The server must use that same database and auth secret. Before note mutations, each test confirms the server recognizes its newly inserted temporary account. No existing QA account, OAuth login, or feature grant is needed.

## Isolation and coverage

Nine persistence regressions cover: failed-sync close/Notes reopen/modal→full/reload; browser-only durable URLs and server identity; conflict reload/RSC identity; stale Use mine rejection followed by a conditional save; informed/fresh Use saved; lost-response Keep both retries in place and after reload; failed freshness-read blocking/retry; and direct Open saved retaining two browser versions through navigation/refresh.

Two additional regressions in `scripts/browser/note-card-colors.spec.ts` check authored card fills in Paper & Ink light/dark: a blue saved note becomes a red browser continuation, and a new green browser-only note becomes a saved note. They check actual computed colors (normalized to sRGB), one card per note, failed-sync close, collection reload, and eventual server theme. Screenshots of both local cards are retained in each test's output directory. These tests wait for successful identity handoff before closing after retry; they do not cover closing during that handoff.

Two regressions in `scripts/browser/note-close.spec.ts` cover closing during recovered creation: close initiates the retry, or waits for an existing in-flight retry. Each holds the committed server creation response until close is pending, then checks the exact Notes URL, absence of an editor, one card/creation, persisted content, reload, and reopening. Both failed before the close-lifecycle correction and pass afterwards.

Six regressions in `scripts/browser/note-account-lifecycle.spec.ts` cover logout Review from Notes/settings (new work and saved-note continuations), canceling logout, real sign-out with Keep, Discard cancellation/confirmation, retained recovery across two accounts, an expired signed session rejected by the real save endpoint followed by same-account recovery, and live account changes in both collection and editor views. Review expectations require the separate `/collection/browser-work` route, no Create note button, and a Back to notes icon link. Account-change checks use the actual session-refresh path and ensure the previous account's content disappears while its local records remain intact. Fixtures issue signed sessions for isolated accounts; Google OAuth interaction is not automated.

Four regressions in `scripts/browser/note-browser-work.spec.ts` cover new/saved continuations returning to Browser work after reload and close, chooser Review later from ordinary and recovery entry, Open saved with competing-copy retention, reopening cached editors, Close comparison staying in the editor, and conflict entry/Keep both with a lost creation response. Return context must survive identity handoff and retry; ordinary Notes behavior remains covered by the earlier suite. The existing suite contains 23 cases. Eleven working-copy regressions in `scripts/browser/note-edit-copy.spec.ts` cover identical content/resumption/reload/mobile undo, stale saves and retained sources, discard/start again, lost-response Keep both in place/after reload, account isolation, Keep both directly from a retained source, active-worker history messaging, and discarding source then working copy while preserving a live saved-note editor. Two additional desktop/mobile long-content regressions check real wheel scrolling, the final text, independent panes, tab scroll position, and pinned actions. Together these are 34 unique browser cases. All existing cases passed; all new cases passed across final scoped reruns, and the two existing chooser cases were rerun after the handoff fix. This is not a single clean 34-case execution. Zero retries were configured.

The same suite can target a local production build (`pnpm build`, then `pnpm start --port 3002`, with `NOTES_TEST_ORIGIN=http://localhost:3002`). Set the preview server's `AUTH_URL` and `NEXTAUTH_URL` to that same origin so logout redirects do not move to another port and its separate browser storage. Run build and browser verification sequentially: development hot reload and route output changes during a concurrent production build can disrupt navigation. The fixture's session check still requires the server and tests to share the same local database and auth secret.

- Each test creates a unique account, signs a session using the existing local HTTP-test pattern, and uses a fresh browser context. Account-switch cases create a second unique account in that same context. Notes are created/updated through authenticated sync HTTP; editing, navigation, checkpoints, and decisions use the actual app UI. The competing-version case uses two tabs sharing only that test context.
- Teardown closes browser controllers, then transactionally removes only the temporary account's notes/account. Creation keys cascade on account deletion; browser recovery disappears with the disposable context. Failure and timeout teardown uses the same cleanup path.
- HTTP interception introduces sync failures, stale writes, failed freshness reads, and a committed creation whose response is lost. Assertions check actual server revisions, content, copy count, retry identity, browser recovery, and navigable URLs. No production test hooks or persistence mocks are added.
- RSC refresh exercises the app's `note-list-stale` event, observes the RSC response, allows rendering, then checks editor identity/content and subsequent UI interactions. Development RSC streams may stay open; the test does not wait for stream closure.
- Service workers are blocked to make transport failures deterministic except in the explicit working-copy worker case, which waits for activation and exercises cloneable history messages. A fresh worker-enabled run also emitted React hydration error 418 before copy actions; that broader worker/hydration behavior remains outside this scoped regression. This suite covers EN/desktop Chromium persistence behavior; it does not establish offline launch, service-worker behavior, physical-device/IME, all locales/appearances, or all browser engines.

Failures retain traces/screenshots under `.playwright-mcp/note-regressions/` (git-ignored). Inspect a trace with `pnpm exec playwright show-trace <trace.zip>`. The default is one worker and zero retries so regressions are visible.
