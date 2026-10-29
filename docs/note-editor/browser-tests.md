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

Nine regressions cover: failed-sync close/Notes reopen/modal→full/reload; browser-only durable URLs and server identity; conflict reload/RSC identity; stale Use mine rejection followed by a conditional save; informed/fresh Use saved; lost-response Keep both retries in place and after reload; failed freshness-read blocking/retry; and direct Open saved retaining two browser versions through navigation/refresh.

- Each test creates a unique account, signs a session using the existing local HTTP-test pattern, and uses a fresh browser context. Notes are created/updated through authenticated sync HTTP; editing, navigation, checkpoints, and decisions use the actual app UI. The competing-version case uses two tabs sharing only that test context.
- Teardown closes browser controllers, then transactionally removes only the temporary account's notes/account. Creation keys cascade on account deletion; browser recovery disappears with the disposable context. Failure and timeout teardown uses the same cleanup path.
- HTTP interception introduces sync failures, stale writes, failed freshness reads, and a committed creation whose response is lost. Assertions check actual server revisions, content, copy count, retry identity, browser recovery, and navigable URLs. No production test hooks or persistence mocks are added.
- RSC refresh exercises the app's `note-list-stale` event, observes the RSC response, allows rendering, then checks editor identity/content and subsequent UI interactions. Development RSC streams may stay open; the test does not wait for stream closure.
- Service workers are blocked to make transport failures deterministic. This suite covers EN/desktop Chromium persistence behavior; it does not establish offline launch, service-worker behavior, physical-device/IME, all locales/appearances, or all browser engines.

Failures retain traces/screenshots under `.playwright-mcp/note-regressions/` (git-ignored). Inspect a trace with `pnpm exec playwright show-trace <trace.zip>`. The default is one worker and zero retries so regressions are visible.
