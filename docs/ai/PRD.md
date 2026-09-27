# PRD — Vietnamese Persona Interview Simulator (v1)

## Overview

A feature that lets a non-technical researcher create AI-driven Vietnamese personas (distinct name, background, personality, region/dialect) and interview them — either one at a time in a live chat, or as a batch of ~50 running the same question set — to produce realistic, diverse simulated interview transcripts.

> **Update note:** built as a new feature inside the owner's existing, already-deployed Next.js note-taking app, not a standalone new app/repo. That host app already solves auth (NextAuth Google SSO), storage (Drizzle + Postgres), and VI/EN localization (next-intl) — this feature reuses all three rather than re-deciding them. See ARCHITECTURE.md's "Integration & isolation" section for what's reused vs. kept isolated. This is a delivery-mechanism change, not a scope change — all Core Features below are unchanged.

Backend inference runs on the owner's local PC (LM Studio, Gemma 4 26B-A4B or a roleplay finetune) exposed publicly via Tailscale Funnel. Frontend is the host app's existing Next.js deployment on Vercel.

## Goals

- Let a non-technical user generate a diverse cast of ~50 personas without writing a single bio by hand.
- Produce interview transcripts that read as natural, human, in-character Vietnamese (or English), not generic "AI assistant" voice.
- Make results exportable and analyzable (persona traits → answers).

## Non-goals (v1)

- Persona avatars / generated images.
- Long-term persona memory across separate sessions (companion-app territory — intentionally deferred, see the planned `ai/companion` feature in ARCHITECTURE.md).
- A separate multi-user role/permission system for this feature — access is a single binary flag per user (`feature_access` table, see ARCHITECTURE.md), not tiered roles or permissions within the feature itself.
- Multi-GPU / high-concurrency serving — single local GPU, requests are effectively sequential.
- Batch runs continuing with no browser tab open — v1 batch is driven by the open tab (see ARCHITECTURE.md "Batch execution model"); a PC-side worker that runs unattended is deliberately deferred (the DB schema is identical either way, so switching later is additive).

## Users

- **Owner (you):** sets up infra, defines persona schema, may create personas too.
- **Researcher (your friend):** non-technical, VI-first UI, creates personas, runs interviews, reads/exports transcripts. Needs the whole flow to be low-effort and forgiving of mistakes (edit/reroll, not just one-shot forms).

## Core Features

### 1. Persona creation — Single

- Structured fields: name, gender, age, region/dialect (Bắc / Trung / Nam), income bracket, occupation.
- Freeform tag input (not a fixed badge grid) for background/context traits — type to pick existing tags or add new ones on the fly.
- Personality expressed as **sliders** (continuous), not just tags — e.g. reserved↔talkative, trusting↔guarded, calm↔anxious. Tags stay for categorical traits (region, job, income); sliders for genuinely continuous ones.
- One free-text field: "quirks / life detail" — a specific memory, speech habit, pet peeve. This is what breaks templated-sounding personas.
- **Interview stance** field: cooperative / guarded / talkative / suspicious — independent from personality, because how forthcoming someone is in an interview is its own axis.
- AI-drafts a full bio + system prompt from the above, shown for edit/regenerate before saving. User never hand-writes the final bio from scratch. The generated system prompt is compact and persona-unique (identity, dialect voice, stance); universal speech rules are enforced at runtime by an appended contract, not baked into each persona.

### 2. Persona creation — Bulk

- User describes a target mix in plain language or simple distribution controls ("mostly Hanoi, mix of ages, skew lower-income").
- AI proposes a batch of candidate personas at once.
- Fast swipe-review UI per candidate: keep / edit / reroll — not a form re-fill.
- Diversity guard: existing roster's names/key traits are passed into generation prompts to avoid near-duplicate personas (same archetype, same name pool).

### 3. Interview — Single (interactive chat)

- Live streaming chat with one selected persona.
- Useful for exploratory/manual interviewing, or spot-checking a persona's voice before including it in a batch run.
- Replies must read as natural Vietnamese khẩu ngữ — short, 1–3 câu, never an essay or a list.
- Speech must follow Vietnamese ngôi/thứ/bậc xưng hô grounded in the persona's age/status, stable per session.
- Must show human turn realism: partial answers, forgetting, suddenly recalling info from an earlier question, mishearing, biased personal opinions.
- Bare greetings must be handled as a person would: short reply back — no interrogation, no volunteering what they're doing.
- Must never break role or reveal being an AI.
- These behavior requirements are enforced via the `PERSONA_SPEECH_CONTRACT` in `lib/ai/persona-style.ts`, appended to the persona's system prompt at chat time.

### 4. Interview — Group / Batch run

- Define a fixed question script once.
- Run it across a selected set (or all) personas automatically.
- Progress view while it runs (LM Studio serves ~1 request at a time — batch runs are sequential, show a queue/progress indicator, not a spinner with no feedback).
- The run is executed in small steps driven by the open browser tab (each step = one question-answer for one persona, well under the route's 60s maxDuration (Hobby platform ceiling is 300s with Fluid compute)). Closing the tab pauses the run — nothing is lost, resume continues from saved state. See ARCHITECTURE.md "Batch execution model".
- Produces one transcript per persona, all tied to the same question-set run for later comparison.

### 5. Export

- Per-persona and per-run export (Markdown and/or CSV): persona traits + full Q&A transcript.
- This is likely the actual deliverable your friend cares about — build early, not as an afterthought, so gaps in the persona schema surface quickly.

### 6. Auth

- v0/v1: reuses the host app's existing NextAuth.js Google SSO for identity — no new auth system built for this feature.
- Access is granted per-user via a `feature_access` table (see ARCHITECTURE.md), managed by an admin (`archivist` role) through a user-management screen — a binary "has access to this AI feature or not" per user, extensible to future AI features (companion chat) without redeploying anything.

### 7. Localization

- UI in Vietnamese and English (toggle). v1 persona chat is **Vietnamese-only**; a per-run interview-language setting (with EN chat) is deferred — adding it later is one schema column, not a redesign.

## Open questions (to resolve during build)

- ~~Exact slider set for personality~~ — resolved: `calm_anxious` / `optimistic_cynical` / `frugal_spendthrift`. Interview-behavior axes (talkative, guarded, suspicious) belong to `interview_stance`, not sliders — see PERSONA-SCHEMA.md.
- What counts as a "near-duplicate" persona for the diversity guard — name only, or name + trait-combo similarity?
