# Architecture — v1

> **Update note:** built as a new feature inside the owner's existing, already-deployed Next.js app (`note-next`), not a standalone repo. See "Integration & isolation" below for what's reused vs. kept separate. This doc covers the AI features only (`app/[locale]/ai/**`) — the note-taking side of the app has its own architecture, not documented here.

## Stack

- **Frontend/backend:** the host app's existing Next.js 16 (App Router), TypeScript 7, Tailwind 4.3, deployed on Vercel — no new deployment.
  - Server actions / API routes hold the LM Studio API key and call the inference endpoint — never call it directly from client JS.
  - Vercel AI SDK for streaming chat UI (single-interview mode).
  - **Vercel duration limits (Fluid compute): Hobby = 300s default and max; Pro = 300s default / 800s max.** Every AI route still sets `export const maxDuration = 60` as a conservative choice — raise per-route only if a slow local model proves it tight. Streaming does _not_ exempt a function from the timer: the function forwarding a stream executes from first token to last. All long work is chunked into per-step budgets well under the route's own maxDuration — see "Batch execution model".
  - Per-call LM Studio timeouts also live in `config/ai.ts`: `AI_REQUEST_TIMEOUT_MS = 45_000` (chat, session title) and `AI_DRAFT_TIMEOUT_MS = 120_000` (persona drafting JSON — generate/regenerate).
- **Inference:** LM Studio running locally (Gemma 4 26B-A4B UD-Q4, or a roleplay finetune — see model notes below), exposed via Tailscale Funnel (`*.ts.net`, public HTTPS, no port-forwarding needed).
  - LM Studio's built-in auth is used — key passed server-side only.
- **Storage:** the host app's existing Postgres instance, via its existing Drizzle ORM 1.0.0-rc.4 setup. New schema files only (see below) — no shared tables, no migration of existing data.
- **Auth:** the host app's existing NextAuth.js 5.0.0-beta Google SSO. See "Auth" below.

## Integration & isolation

The host app is open to public Google sign-up (10 users currently), built for note-taking, and has its own `role` enum (`archivist` / `note-taker`) on `usersTable` that's semantically about note-domain permissions. This feature reuses the host app's infra but stays isolated from it everywhere else:

- **Routes:** `app/[locale]/ai/interview/`, with its own layout — separate from the note-editor's routes/layout, so a slow or offline LM Studio backend can't degrade note-taking for the other 10 users. `ai/` is reserved as the shared parent for future AI features (a planned **companion chat** feature will live at `app/[locale]/ai/companion/` as a sibling) — different shape (persistent single relationship vs. batch personas + transcripts), so kept as separate routes/layouts/schemas, not merged, but nested under one parent now so adding it later is additive, not a restructure. The LM Studio inference-client wrapper and chat-bubble UI primitives are the pieces actually worth sharing between the two; everything else (schema, access control) stays feature-scoped.
- **Schema:** new files under `db/schema/` (`personas.ts`, `transcripts.ts`, `runs.ts`) — no foreign keys into the notes tables. This is a separate domain sharing only the Postgres instance. (`usersTable` is the one exception — see Auth below, which references it for access control, not data.)
- **Editor:** skip Tiptap for persona/transcript free-text fields (bio, quirks, Q&A content) — these are short plain-text fields per PERSONA-SCHEMA.md, not rich-text; pulling in the host app's rich-text editor would be unneeded weight for fields that don't need it.
- **Service worker (serwist):** verify its caching rules don't intercept the new API routes or the streaming chat response — PWA caching and a live LM Studio stream don't mix well if scoped too broadly. Check/add an exclusion rule before shipping, don't assume it's fine by default.

## Auth

- Reuses the host app's existing NextAuth Google SSO for identity — no new auth system, no new login flow.
- **Access control is a separate, additive gate, not a change to `role`:** don't repurpose or extend the `archivist`/`note-taker` enum for this — that enum is note-domain permissions, and overloading it (or migrating it) to also mean "can access this AI feature" mixes two unrelated permission systems and touches a table with 10 live users for no reason.
- Instead: a small additive table, since there's now more than one AI feature to gate (persona interview now, companion chat later) — a single env var per feature doesn't scale past one, and doesn't let an admin manage access without a redeploy:
  ```ts
  export const featureAccessTable = pgTable(
    'feature_access',
    {
      userId: uuid('user_id')
        .notNull()
        .references(() => usersTable.id),
      feature: text('feature').notNull(), // 'persona-interview' | 'companion-chat' | ...
      grantedAt: timestamp('granted_at', {withTimezone: true})
        .defaultNow()
        .notNull(),
    },
    (t) => ({
      pk: primaryKey({columns: [t.userId, t.feature]}),
    }),
  )
  ```
  Checked as one query in a layout guard scoped to `app/[locale]/ai/interview/**` (and later `.../companion/**` independently). **Layout checks alone protect nothing** — server actions and API routes are directly invocable from client JS. The repo's request interceptor is `proxy.ts` (Next.js 16 renamed `middleware.ts` to `proxy.ts`; named export `proxy` with `NextProxy`/`ProxyConfig` types from `next/server`, Node.js runtime only — the edge runtime is no longer supported there), but it currently only runs next-intl locale routing and holds no auth or feature-access logic, and per-feature DB gating belongs with the feature, not in the global request path. The real gate is one shared helper, `requireFeatureAccess(userId, feature)`, called at the top of _every_ AI server action and API route handler; the layout check is UX (redirect to a "no access" state), the helper is the enforcement. References `usersTable.id` for identity only — no FK into personas/transcripts.
- **Admin grants access via a user-management screen**, not an env var or a migration: an `archivist`-gated screen where the admin inserts/deletes rows in `feature_access` for a given user + feature. `role` decides _who can manage access_ (archivists only); `feature_access` decides _what a given user has access to_. Two separate, uncontaminated concerns — the existing role field doesn't need to change to support this.

## Data flow

1. User (owner or researcher) creates persona(s) via UI → Next.js server action → LM Studio (bio/system-prompt drafting) → saved to DB. Drafting produces a compact, persona-unique systemPrompt (identity, dialect voice, stance) — universal speech rules are enforced at runtime by the appended `PERSONA_SPEECH_CONTRACT`, not baked into the prompt.
2. Single interview: client streams chat turns through a Next.js API route → LM Studio → streamed back to client. Turns append atomically to one transcript row per interview session (single-statement JSONB append — not one row per turn).
3. Group/batch interview — browser-driven loop (see "Batch execution model"): the client calls a server action per question-step (one persona, one question) → LM Studio (sequential, one request at a time) → the action appends the turn to that persona's transcript (single-statement JSONB append) and advances its `run_items` row → client calls the next step until the run completes. Progress UI reads DB state; closing the tab pauses the run, resume continues from saved turns.
4. Export: server action reads DB rows for a persona or run → renders Markdown/CSV → download.

## Batch execution model

Vercel Hobby functions cap at 300s wall-clock with Fluid compute (300s is both the default and the max on Hobby; Pro allows up to 800s), and streaming does not exempt a function from that timer. But the per-step budget for a batch comes from the route itself: each AI route sets `maxDuration = 60`, plus the 45s per-call LM Studio timeout on top. A 50-persona batch is ~500 sequential LM Studio calls ≈ hours — it can never live inside one invocation, and LM Studio can't sequence requests itself (it answers one completion at a time; orchestration is always the app's job). Something long-lived must own the loop; on this stack, the browser is it:

- **The open browser tab owns the loop.** It repeatedly calls a `runNextStep(runId)` server action; each call executes exactly one question-step for one persona (well under the route's 60s maxDuration), appends the turn to the transcript, and updates `run_items`. The client loop continues until every item is done.
- **State lives in the DB, not the tab.** Closing the tab mid-run = the run stalls (`in_progress` with stale `updated_at`; UI shows "stalled — resume"). Resume continues from the last saved turn; unique `(run_id, persona_id)` prevents duplicate transcripts on retry.
- **Failure policy: skip-and-continue.** A failed step marks its `run_items` row `failed` with the error text; the loop moves to the next persona. A run ending with failed items is flagged partial — the researcher re-runs just the failed personas.
- **Bulk persona drafting uses the same pattern** — the client requests candidates in small pages (~5 per call) instead of one 50-bio invocation.
- **Alternative deliberately not taken for v1:** a small worker process on the PC driving the loop (browser-independent, free of the 300s Hobby function limit). Schema and step granularity are identical either way, so switching later is additive, not a redesign. Deferred because it adds a long-running process to keep alive for v1's two users.

## Constraints to design around

- **Single-GPU concurrency:** LM Studio serves ~1 request at a time. Batch runs are inherently sequential — surface a real progress indicator (N of 50 done), don't let the UI look stuck.
- **PC uptime = app uptime:** the backend lives on a home PC. Explicitly deferred, not solved: v0 scope is just the owner + one researcher, and that's accepted as-is for now. v1 must address this properly (health-check ping, a visible "assistant offline" state instead of raw failed requests) — keep the UI hook in place so it's a small addition later, not a redesign, but don't build the actual health-check logic yet.
- **GGUF model swaps:** keep the model name/endpoint in one config value — you'll likely A/B stock `-it` vs StyleTune vs a roleplay finetune, want that to be a one-line change, not a code change.
- **Rate-limit AI routes:** reuse the existing `@upstash/ratelimit` setup (`config/system.ts`) on AI API routes even though `feature_access` gates entry — the Funnel endpoint is public and server actions are cheap to spam.

## Model notes (decided)

**Model:** `alexisStacksCode/Gemma-4-26B-A4B-StyleTune-V2-QAT-GGUF`, `UD-Q4_K_XL` quant, vision tensors removed. This is Gryphe's `Gemma-4-26B-A4B-StyleTune-V2` (only the `lm_head` output projection retrained — one tensor out of 659; reasoning/instruction-following are stock Gemma 4 26B-A4B-it underneath) merged onto Google's QAT checkpoint for accurate low-bit quantization.

**What the request payload must set explicitly** (values are pinned app-side in `AI_SAMPLER` in `config/ai.ts`; the `lib/ai/lm-studio.ts` wrapper consumes them — per-model sampler presets in that config are the plan for future model A/B): `temperature=1.0`, `min_p=0.10`; on the wire `top_p` is sent as 1 and `top_k` as 0 via `providerOptions` passthrough, because the openai-compatible provider drops the standardized `topK` setting (without it, llama.cpp's default top_k 40 would apply — min_p does the truncation). Do not send an `enable_thinking` flag, or send it explicitly as `false` — this model's chat template defaults to thinking disabled only when that flag is absent or false; if any client library defaults it to `true`, override it. Nothing in the `Transcript.turns` schema has a field for reasoning content, so thinking output must never reach the DB.

**Already configured at the LM Studio server level — the app's code does not need to set or replicate these:** DRY sampler (multiplier 0.8, base 1.75, allowed_length 2, penalty_last_n ~2048) and classic repeat_penalty (off), both set as server-level llama.cpp overrides. `--parallel 1` (this app never serves concurrent requests — more than 1 wastes VRAM on unused KV cache slots). Context length sized to actual interview turn length, not the model's 256K max. Full GPU layer offload where VRAM allows. If sampling behavior looks wrong in production, check the LM Studio server config first — these are operator-side settings, not application bugs.

**MTP (multi-token prediction / speculative decoding): not used.** Google stripped MTP heads from Gemma 4's public release; community MTP support only exists as separate purpose-built GGUFs with re-added draft heads, not as a toggle on an arbitrary quant. This StyleTune+QAT file isn't one of those builds, and chasing it isn't worth it for v1 — the actual bottleneck is sequential batch throughput across ~50 personas (a progress indicator solves that), not raw decode speed.

**Provenance is recorded, not assumed.** Because model A/B swaps are a one-line config change, every run and transcript stores the model identifier and a snapshot of the system prompt used at generation time (PERSONA-SCHEMA.md) — otherwise transcripts from different models are indistinguishable in the export, and the A/B comparison is worthless. Note the snapshot is the authored prompt as stored on the persona: at call time the chat route appends `PERSONA_SPEECH_CONTRACT` (from `lib/ai/persona-style.ts` — the Vietnamese speech rules) to it, so the effective system message = snapshot + contract, while the snapshot column stays exactly as authored.
