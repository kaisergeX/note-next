# Browser regressions

See the [handoff](handoff.md#verification) for results against the current implementation and the [delivery history](archive/2026-10-phase-3-history.md) for earlier runs.

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

- Persistence and conflicts cover failed-sync close and reopen, durable browser URLs, server identity acquisition, reload/RSC identity, stale Use mine, fresh Use saved, lost-response Keep both in place and after reload, blocked freshness reads, and Open saved retaining competing versions.
- `note-card-colors.spec.ts` checks authored card fills in Paper & Ink light/dark: a saved note with a browser continuation and a new browser-only note with a later server identity. It checks actual computed colors, one card per note, failed-sync close, reload, and eventual server theme.
- `note-close.spec.ts` holds a committed creation response to test closing during a new or in-flight retry. It checks return to Notes, one card/creation, persisted content, and reopening.
- `note-account-lifecycle.spec.ts` covers logout Review from Notes/settings, canceling logout, real sign-out with Keep, scoped Discard, expired sessions, and live account switching with recovery retention. Fixtures issue signed sessions for isolated accounts. Google OAuth interaction is outside the suite.
- `note-browser-work.spec.ts` covers the dedicated Browser work route, return context after reload/close and identity acquisition, chooser Review later, competing-version retention, reopening cached editors, and comparison dismissal.
- `note-edit-copy.spec.ts` covers separate working copies and retained sources, resumption/reload, mobile undo, stale writes, discard, lost-response Keep both, account isolation, worker history handoff, independent wheel scrolling and tab positions, and post-resolution reload with an independent remote edit.

The suite can also target a local production build (`pnpm build`, then `pnpm start --port 3002`, with `NOTES_TEST_ORIGIN=http://localhost:3002`). Set the preview server's `AUTH_URL` and `NEXTAUTH_URL` to that origin so logout redirects preserve browser storage context. Finish the build before browser verification to avoid changing route output during navigation. The server and fixtures still need the same local database and auth secret.

## Fixtures and limits

- Each test creates a unique account, signs a session using the existing local HTTP-test pattern, and uses a fresh browser context. Account-switch cases create a second unique account in that same context. Notes are created/updated through authenticated sync HTTP; editing, navigation, checkpoints, and decisions use the actual app UI. The competing-version case uses two tabs sharing only that test context.
- Teardown closes browser controllers, then transactionally removes only the temporary account's notes/account. Creation keys cascade on account deletion; browser recovery disappears with the disposable context. Failure and timeout teardown uses the same cleanup path.
- HTTP interception introduces sync failures, stale writes, failed freshness reads, and a committed creation whose response is lost. Assertions check actual server revisions, content, copy count, retry identity, browser recovery, and navigable URLs. No production test hooks or persistence mocks are added.
- RSC refresh exercises the app's `note-list-stale` event, observes the RSC response, allows rendering, then checks editor identity/content and subsequent UI interactions. Development RSC streams may stay open; the test does not wait for stream closure.
- Service workers are blocked to make transport failures deterministic except in the explicit working-copy worker case, which waits for activation and exercises cloneable history messages. A fresh worker-enabled run also emitted React hydration error 418 before copy actions; that broader worker/hydration behavior remains outside this scoped regression. This suite covers EN/desktop Chromium persistence behavior; it does not establish offline launch, service-worker behavior, physical-device/IME, all locales/appearances, or all browser engines.

Failures retain traces/screenshots under `.playwright-mcp/note-regressions/` (git-ignored). Inspect a trace with `pnpm exec playwright show-trace <trace.zip>`. The default is one worker and zero retries so regressions are visible.
