# Build Plan — persona interview feature

> Read PRD.md, ARCHITECTURE.md, and PERSONA-SCHEMA.md first — this file is only
> the *order of construction* and what "done" means for each phase. It does not
> re-decide anything those docs already settle. Phases are sequential; each one
> ends with something runnable to verify before moving on.

## Progress log

- **2026-09-26 — Phase 0 complete.** Implemented: `db/schema/personas.ts` (personas table, `persona_status` enum draft/active/archived), `db/schema/transcripts.ts` (`runs`, `transcripts` with nullable `run_id` FK plus `model` and `system_prompt` snapshot columns, `run_items` with unique `(run_id, persona_id)` constraint), `config/ai.ts` (`AI_LOCALES` region map, LM Studio endpoint/key/model via env vars with fallbacks, `AI_SAMPLER` constants: temperature 1.0, min_p 0.1, top_p/top_k disabled, thinking off), and Zod persona input validation at `lib/ai/persona-validation.ts` (region validated against `AI_LOCALES[locale].regions`). Migration `drizzle/20260926071750_curvy_photon` generated and applied. Verified: migration applied, app-side insert/select confirmed by owner, `pnpm lint` passes. Note: all new tables use the pre-existing `generate_ulid()` function from the `functions` migration for UUID PK defaults.
- **2026-09-26 — Doc correction (pre-Phase 1).** `docs/ai/ARCHITECTURE.md` Auth section: replaced the outdated "this repo has no middleware.ts" claim with the Next.js 16 reality — the repo's request interceptor is `proxy.ts` (named export `proxy`, `NextProxy`/`ProxyConfig` types, Node.js runtime, edge unsupported), which currently only runs next-intl locale routing. Enforcement decision unchanged: `requireFeatureAccess(userId, feature)` remains the real gate at the top of every AI server action/API route handler; no `feature_access` logic goes in proxy.
- **2026-09-26 — Phase 1 complete.** Implemented: `db/schema/feature-access.ts` (`feature_access` table: composite PK `(user_id, feature)`, text `feature`, `granted_at` timestamptz defaultNow, FK → users.id, no surrogate id column per ARCHITECTURE.md), migration `drizzle/20260926103813_living_chronomancer` generated and applied with `pnpm db:check` clean, `lib/ai/feature-access.ts` (`AI_FEATURES`/`AIFeature` type, `FeatureAccessError`, `requireFeatureAccess(userId, feature)` — exactly one query, throws the typed error when no row exists), UX layout guard `app/[locale]/ai/interview/layout.tsx` (`requireAuth()` → `requireFeatureAccess(userInfo.id, 'persona-interview')` → `redirect('/denied/ai-access')` on `FeatureAccessError` only, all other errors rethrown), placeholder `app/[locale]/ai/interview/page.tsx`, no-access page `app/[locale]/denied/ai-access/page.tsx`, and the `ai` namespace added to both `dictionaries/en.json` and `dictionaries/vi.json`. Verified: scratch script against the real DB (no row → throws, row present → resolves with grantedAt, wrong feature `'companion-chat'` → throws, cleanup restores state — 4/4 PASS), unauthenticated `/en/ai/interview` and `/vi/ai/interview` redirect to login, `pnpm lint` clean. Pending owner manual check: an authenticated user without a `feature_access` row lands on `/denied/ai-access` (needs a real Google session), and the owner inserts their own `feature_access` row manually (db:studio / SQL) per the plan — admin screen is Phase 8+ / not planned here.
- **2026-09-26 — Phase 2 complete.** Implemented `lib/ai/lm-studio.ts` — single server-only LM Studio client over Vercel AI SDK (`ai@7.0.114` + `@ai-sdk/openai-compatible@3.0.55`; `ai` core and `@ai-sdk/react` added to deps for the Phase 4 chat UI): `complete()` (generateText, non-streaming, for bio drafting + batch steps) and `completeStream()` (streamText over `fullStream` — error and abort parts are thrown and mapped, text deltas yielded; timeouts/caller aborts can never silently truncate output) with the typed error surface `LMStudioError(kind: 'unreachable' | 'auth' | 'timeout' | 'http')` — the future "assistant offline" hook point (health-check logic still deferred). Ground-rule payload wire-verified against a local capture server: `temperature 1.0`, `min_p 0.1`, `top_p 1`, `top_k 0` (sent via `providerOptions` passthrough because the provider drops the standardized `topK` setting — else llama.cpp's default top_k 40 would apply), `enable_thinking: false`, model from config; DRY sampler never sent from app code. `AI_REQUEST_TIMEOUT_MS = 45_000` in `config/ai.ts`; `maxRetries: 0` (wrapper owns retry policy). Verified live against the deployed Funnel endpoint: success (complete + streamed deltas), refused connection → `'unreachable'`, `timeoutMs: 1` → `'timeout'` (non-streaming and streaming), caller abort propagates the original error unwrapped. `pnpm lint` clean. Caveat for owner: LM Studio server auth appeared inconsistent across verify runs (one run streamed with a deliberately wrong key; a later probe got 401 without a key) — confirm built-in auth is enabled server-side; the wrapper's 401→`'auth'` mapping itself is proven.
- **2026-09-26 — Phase 3 complete.** Implemented: `lib/ai/lm-studio.ts` gained `completeJson()` (generateObject, `supportsStructuredOutputs: true`, `allowSystemInMessages: true` — required by ai@7 for system-role messages; `NoObjectGeneratedError` → `LMStudioError('http','invalid structured output')`); `lib/ai/persona-drafting.ts` (Vietnamese system-prompt template + `buildPersonaDraftMessages(persona, rosterSummary?)` — roster hook ready for Phase 6 diversity guard; tags/province must actually color the bio; sliders interpreted, never recited as numbers; `draftPersona()` re-validates through `personaInputSchema`); `db/helper/personas.ts` (list by statuses, by id, distinct background tags, `buildActiveRosterSummary` — deterministic top-2 sliders by |v−50| with stable-sort tiebreak, active only); `lib/ai/action-result.ts` (`ActionResult` + `flattenFieldErrors`); `app/[locale]/ai/interview/actions.ts` — 6 server actions (create/update/draft-bio/regenerate/set-status/list-tags), every one gated `requireFeatureAccess` FIRST, LMStudioError timeout/unreachable/auth → `reason:'offline'`, no redirects (script-testable). Review-driven fixes: update action no longer lets schema defaults leak (`status`/`locale` applied only when caller provides them — no silent draft-downgrade on edit), corrupt-row locale now safeParse'd instead of escaping as a 500. UI: `components/ai/interview/` (persona-form with free-solo tags + native sliders 0–100 + stance datalist presets cooperative/guarded/talkative/suspicious + quirks + editable bio/systemPrompt with draft/regenerate, persona-tags, persona-slider, persona-bio-panel, persona-roster-card with status badge + archive-confirm) and pages `ai/interview` (roster, drafts+active shown, archived hidden), `ai/interview/new`, `ai/interview/[id]`; single-create saves as `active`. Dictionaries: `ai.interview.{roster,status,form,vi}` expanded in BOTH en.json and vi.json with identical key sets. Verified: schema rejects `region:'Miền Tây'` / accepts Bắc–Trung–Nam; db-crud incl. archived hides from roster but row persists (future transcripts untouched by construction — no hard delete); live draft through deployed Funnel URL: Vietnamese bio weaving 'Hải Phòng', no slider digits, second-person systemPrompt, regenerate differs; `pnpm lint` clean. Owner manual check pending: full CRUD through the browser UI. Note: first bio draft after a cold model load timed out once at 60s (single-slot queue) and succeeded on retry — the offline error state + retry is the designed UX for that.
- **2026-09-26 — Phase 3 follow-up:** `completeJson` migrated off the deprecated `generateObject` to the current `generateText` + `Output.object({schema})` API (ai@7 standard). `result.output` getter access maps `NoObjectGeneratedError` and the new `NoOutputGeneratedError` both to `LMStudioError('http', 'invalid structured output')`. Wire-verified: captured request body carries `response_format` type `json_schema` through the new path, mocked JSON parses to the schema object, and a live `draftPersona` regression through the deployed Funnel URL produced a correct Vietnamese bio + system prompt. `pnpm lint` + Prettier clean.

## Ground rules (apply to every phase)

- Every AI server action and API route handler calls `requireFeatureAccess(userId, feature)` first — the layout check is UX only, this helper is the real gate (ARCHITECTURE.md, Auth).
- Every AI API route sets `export const maxDuration = 60` (Hobby ceiling; default is lower).
- LM Studio endpoint, API key, and model identifier live in exactly one config — model A/B is a one-line change (ARCHITECTURE.md, Model notes).
- New schema files under `db/schema/` follow existing conventions; no path aliases inside `db/schema/*.ts` (AGENTS.md constraint).
- Request payload: `temperature=1.0`, `min_p=0.10`, top_p/top_k disabled, thinking explicitly off. DRY sampler etc. are server-side LM Studio settings — never replicated in app code.

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

**Verify:** candidates arrive as drafts, don't appear in roster or diversity guard until kept; reroll respects the roster summary; 50-candidate session works through the paged loop without hitting the 60s ceiling.

## Phase 7 — Export (deferred by owner decision)

**Scope:** per-persona and per-run Markdown + CSV. UTF-8 **with BOM** (Excel + Vietnamese); one row per Q&A pair; sliders flattened to one column per axis; `background_tags` joined with `;`; run-level columns (`run_id`, `model`) in per-run export.

**Verify:** open the CSV in Excel on Windows — Vietnamese renders correctly, filters work. Cheap early alternative: a throwaway Markdown dump right after phase 5 to sanity-check the data model, deleted before ship.

## Pre-ship checklist (not a phase — sweep before telling the researcher it's ready)

- [ ] serwist: explicit NetworkOnly/exclusion route for `/api/ai/*` in `app/sw.ts` (PWA caching vs live streams).
- [ ] `@upstash/ratelimit` on AI API routes (reuse `config/system.ts` setup).
- [ ] next-intl messages for all new routes in both `en` and `vi`.
- [ ] "assistant offline" failure state in the interview UI (typed errors from phase 2; health-check logic still deferred).
- [ ] Export marks content as simulated personas (research-integrity line in the file header).
