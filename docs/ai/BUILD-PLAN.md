# Build Plan — persona interview feature

> Read PRD.md, ARCHITECTURE.md, and PERSONA-SCHEMA.md first — this file is only
> the _order of construction_ and what "done" means for each phase. It does not
> re-decide anything those docs already settle. Phases are sequential; each one
> ends with something runnable to verify before moving on.

## Progress log
> Full detailed log: docs/ai/BUILD-PLAN-HISTORY.md (verbatim archive).

- **2026-10-10 — Phase 6 UX rework (owner-approved).** Owner live test found two issues. First, the progressive-arrival implementation appeared broken: created candidates never showed while generating — root cause: the whole loop ran inside `startTransition`, deferring `router.refresh()` commits until loop end. Second, mid-batch page refresh let the in-flight server action complete server-side silently (candidate inserted, no UI), then the batch died with the client; owner accepted this as-is (option a — self-healing via Generate-more; no resume-prompt feature). Progressive arrival fixed per owner decision with optimistic rendering instead of router-refresh: `persona-draft-card.tsx` (already the one shared client card used by both the server bulk page and the workbench — no extraction needed) gained optional `onKept`/`onRerolled`/`onDiscarded` callbacks with a `router.refresh()` fallback; `bulk-draft-workbench.tsx` loop now renders each candidate immediately from the action's `PersonaCandidate` return (via `toCardData`, dropping unused `systemPrompt`) into new `arrived` state, display list = server rows minus arrivedIds/removedIds plus arrived cards; Keep/Discard remove the card client-side, Reroll replaces it with the returned replacement (fresh ULID, no id collision); single `router.refresh()` ONCE after loop exit reconciles server truth — dedupe via arrivedIds relies on `.returning()` ids matching the server page's rows; skeleton count stays (total − done), card actions disabled while the loop runs so no drift. No new dictionary keys; en/vi parity 251/251; `pnpm lint` clean. Review found 0 critical — dedupe, guard, and skeleton accounting all verified sound; known accepted nit: reroll failure `notDraft` leaves the stale card (pre-existing fallback behavior).
- **2026-10-10 — Phase 6 bulk UX polish (owner feedback round 2).** Skeleton placeholders now render at the instant Generate is pressed: `setLoop({done: 0, total})` plus the new `loopSource` state moved from inside the `startTransition` callback (React deferred it — same transition race class caught twice now) into the synchronous click-handler section alongside the double-loop guards; the transition callback's local `done` counter remains the increment source; `finally` resets both. Root cause of the "skeletons only after first candidate" symptom. Progress moved into the active button's label: `t('progress', {done, total})` with spinner + `tabular-nums` on whichever button started the loop (`generate(source: 'primary'|'more')`, derived `primaryActive`/`moreActive`), the other button stays idle+disabled; the separate progress `<span>` deleted; the button is now the single progress display. No new dictionary keys. Reviewer-found ghost-card edge fixed: the display filter previously always favored client-side `arrived` copies over refreshed server rows, so a candidate deleted in another tab stayed visible until remount. Fixed with a derive-at-render `serverIds` filter — server truth wins for arrived ids present in fresh server rows; not-yet-on-server copies (just-inserted, lagging one refresh) stay. Implemented as render-time derivation because `react-hooks/set-state-in-effect` forbids setState-in-effect. Stale "no ghosts" comment corrected. `pnpm lint` clean. Owner to re-verify live: skeletons on click, in-button progress, cross-tab delete reconciliation.
- **2026-10-10 — Phase 6 bulk list-disappearance fix.** Owner live test: the draft list went EMPTY right after the last candidate arrived. Root cause: mutual exclusion in the displayed-list derivation — server rows were excluded when their id was in `arrivedIds`, while the arrived client copy was excluded when its id was in `serverIds`; after the end-of-loop reconciliation refresh both were true, so the candidate appeared in NEITHER branch (the previous session's ghost-card fix created this hole). Fix: server rows are primary — filtered only by `removedIds`; arrived client copies are a stopgap rendered only while their id is absent from server rows, replaced by the server row once the refresh lands (`arrivedIds` declaration deleted). All optimistic-card flows re-verified (Keep/Discard/Reroll id suppression, no duplicate React keys). Accepted edge, comment documents it: a candidate deleted in another tab before reconciliation can keep rendering its stale arrived copy for the component's lifetime. `pnpm lint` clean. Owner to re-verify: full 5-candidate batch survives to the end.

## Ground rules (apply to every phase)

- Every AI server action and API route handler calls `requireFeatureAccess(userId, feature)` first — the layout check is UX only, this helper is the real gate (ARCHITECTURE.md, Auth).
- Every AI API route sets `export const maxDuration = 60` (conservative; Hobby now allows 300s default/max with Fluid compute — raise per-route only if a slow local model proves 60s too tight).
- LM Studio endpoint, API key, and model identifier live in exactly one config — model A/B is a one-line change (ARCHITECTURE.md, Model notes).
- New schema files under `db/schema/` follow existing conventions; no path aliases inside `db/schema/*.ts` (AGENTS.md constraint).
- Request payload: `temperature=1.0`, `min_p=0.10`, `top_p=1`, `top_k=0` (both via `providerOptions` passthrough — the openai-compatible provider drops the standardized topK), thinking explicitly off; min_p does the truncation. DRY sampler etc. are server-side LM Studio settings — never replicated in app code.

## Phase 0 — Schema + config (no UI, no LM Studio)

**Scope:** `db/schema/personas.ts`, `db/schema/transcripts.ts` (transcripts, runs, run_items — see PERSONA-SCHEMA.md for exact fields, including `status` on persona, `model` + system-prompt snapshot on transcript, `run_items` unique `(run_id, persona_id)`), `config/ai.ts` (`AI_LOCALES` region map, model/endpoint constants, sampler constants). Zod schemas for persona input validated against `AI_LOCALES[locale].regions`. Generate + apply migration.

**Verify:** `pnpm db:gen` + `pnpm db:migrate` clean; `drizzle-kit check` passes; `pnpm lint` passes; a scratch script (or db:studio) can insert/select a persona, a run, and its items.

## Phase 1 — Access gate

**Scope:** `feature_access` table + migration; `requireFeatureAccess(userId, feature)` helper (one DB query, feature = `'persona-interview'`); layout guard on `app/[locale]/ai/interview/**` for UX (redirect to a "no access" state).

**Verify:** user without a row gets redirected from the layout; calling a protected action directly (curl/script) is rejected by the helper even though the layout never ran. The admin user-management screen is **not** in this phase — for now the owner inserts their own row manually (db:studio / SQL).

## Phase 2 — LM Studio client wrapper

**Scope:** single server-only module: build the request (sampler params, thinking off), call the Funnel endpoint with the API key, expose `complete()` (non-streaming, for bio drafting and batch steps) and `completeStream()` (for the chat route). Error surface: typed failures (unreachable, auth, timeout) so the UI can distinguish "assistant offline" from a bug later (health-check logic itself stays deferred — leave the hook point).

**Verify:** a scratch server action / node script generates one completion through the deployed Funnel URL and one against a wrong key — correct behavior both ways.

## Phase 3 — Single persona create + roster

**Scope:** create/edit persona form (structured fields, free-solo tags, 3 sliders, stance with presets, quirks), bio/system-prompt draft + regenerate server action (uses `complete()`), roster list with `status` handling (draft/active/archived — archived is the delete action).

**Verify:** full CRUD through the UI; bio regenerates; archived persona disappears from roster but its (future) transcripts aren't touched; region validation rejects a non-`AI_LOCALES` value.

## Phase 4 — Single interview chat

**Scope:** streaming chat route (`maxDuration = 60`, uses `completeStream()`), one transcript row per session, turns appended read-modify-write, `model` + `system_prompt` snapshot written at session start.

**Verify:** in-character Vietnamese streamed turn by turn; transcript row grows per turn; closing mid-answer loses only that answer; snapshot columns populated.

## Phase 5 — Batch run

**Scope:** question script input; run + run_items creation; `runNextStep(runId)` server action (one question-step per call: pull next pending item, build prompt with the persona's prior turns, `complete()`, append turn, advance item); client loop component; progress UI (N of M done, stalled → resume); skip-and-continue failure handling with per-item error text; retry-failed-personas action.

**Verify:** 3-persona dry run end to end; kill the tab mid-run → status shows stalled → resume completes without duplicate transcripts; forced failure on one persona → run completes partial → retry fixes only that persona.

## Phase 6 — Bulk persona drafting

**Scope:** plain-language mix description → candidate pages (~5 per call, reusing the phase-3 drafting prompt + diversity-guard roster summary of `active` personas); swipe-review keep/edit/reroll; `draft` → `active` promotion on keep.

**Verify:** candidates persist as `draft` rows and DO appear in the roster (badge) and count in the diversity guard until kept (keep → `active`) — per owner decision 2026-10-09, superseding the original "don't appear in roster or diversity guard until kept"; reroll respects the roster summary; the paged loop stays under the duration ceiling. Still to run by the owner: the live 50-candidate loop dry run.

## Phase 7 — Export (deferred by owner decision)

**Scope:** per-persona and per-run Markdown + CSV. UTF-8 **with BOM** (Excel + Vietnamese); one row per Q&A pair; sliders flattened to one column per axis; `background_tags` joined with `;`; run-level columns (`run_id`, `model`) in per-run export.

**Verify:** open the CSV in Excel on Windows — Vietnamese renders correctly, filters work. Cheap early alternative: a throwaway Markdown dump right after phase 5 to sanity-check the data model, deleted before ship.

## Pre-ship checklist (not a phase — sweep before telling the researcher it's ready)

- [x] serwist: explicit NetworkOnly/exclusion route for `/api/ai/*` in `app/sw.ts` (PWA caching vs live streams) — shipped in Phase 4, pulled forward by owner decision.
- [ ] Ratelimit on AI routes + expensive server actions. @upstash/ratelimit over Redis REST (env `REDIS_KV_REST_API_URL` + `REDIS_KV_REST_API_TOKEN` — KV-style names from Vercel provisioning; not `UPSTASH_REDIS_REST_*`, not the plain `REDIS_URL`, which is a connection URL @upstash/ratelimit cannot read). Per-user identifier enforced after auth + requireFeatureAccess, before the LLM call. Scope: window limits on chat POST, generatePersonaAction, generateSessionTitleAction, extractQuestionsAction, createRunAction, retryFailedRunItemsAction; window + 1 concurrent on runNextStepAction (client loop parallel-able across tabs). Skip: rename/delete session (cheap DB writes), export GET routes (cheap DB reads). Block → 429 on API routes, ActionResult reason 'limited' on actions + UI banner key en+vi. Vercel Firewall skipped: static/IP-based, can't read user identity, AI server actions are page POSTs indistinguishable from form posts, 3-rule cap.
- [x] next-intl messages for all new routes in both `en` and `vi` — every phase verified parity (133/133, 182/182); final sweep lands with the ratelimit UI keys.
- [x] "assistant offline" failure state in the interview UI — Phase 4 in-stream error part → sentinel banner, Phase 5 per-item error kinds; health-check logic still deferred by design.
- [x] Export marks content as simulated personas (research-integrity line in the file header) — Phase 7, every Markdown opens with the integrity line.
