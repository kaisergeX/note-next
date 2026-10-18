# AI Persona Interview — Build Status

This file is the current implementation guide for agents working on the AI persona
interview feature. Read the relevant source-of-truth docs before changing behavior.
Use the archived build history when implementation rationale or chronology is needed.

## Read first

- [PRD.md](PRD.md) — product scope and user-facing behavior.
- [ARCHITECTURE.md](ARCHITECTURE.md) — integration boundaries, data flow, and infrastructure decisions.
- [PERSONA-SCHEMA.md](PERSONA-SCHEMA.md) — database model, diversity guard, and export contracts.
- [ai-persona-interview-build-plan-history.md](../archive/ai-persona-interview-build-plan-history.md) —
  detailed implementation and decision history.

## Current status

Phases 0–7 are implemented. The remaining pre-ship work is listed below.

- **Phase 6 — Bulk drafting:** candidates generate progressively, one per call. Review uses
  traditional cards with keep, edit, reroll, and discard actions. Swipe review was deliberately
  not built. Draft candidates appear in the roster and diversity guard until kept.
- **Phase 7 — Export:** persona, run, and session exports are implemented. Markdown reports
  and versioned JSON backups cover all three scopes; flat CSV covers personas and runs; wide
  comparison CSV covers runs. CSV downloads include a UTF-8 BOM. The owner verified an export
  in Excel.

## Implementation invariants

- Enforce `requireFeatureAccess(userId, feature)` in every AI server action and API route.
  Layout checks only control navigation and are not authorization.
- Keep the LM Studio endpoint, API key, model, and sampler configuration centralized in `config/ai.ts`.
- AI calls use `temperature=1.0`, `min_p=0.10`, `top_p=1`, `top_k=0`, and thinking disabled.
  `top_p` and `top_k` use provider passthrough options. DRY and repeat penalties are configured
  in LM Studio, not in app requests.
- Keep AI route `maxDuration` at 60 seconds unless measurements justify changing it. Keep each
  batch step within its own request and timeout budget.
- Follow existing Drizzle conventions. Do not use path aliases in `db/schema/*.ts`.
- Keep user-facing AI text localized in both `en` and `vi`.

## Remaining work

- [ ] Run a live 50-candidate bulk-generation dry run. Confirm progressive arrivals, cancel
  behavior, and recovery after a partial failure.
- [ ] Add per-user rate limits after authentication and feature-access checks, before expensive
  model calls. Cover the chat route, persona drafting and rerolls, title generation, question
  extraction, run creation, batch steps, retries, and bulk candidate generation. Limit concurrent
  batch steps across tabs. Return `429` from API routes and localized action errors from server
  actions. Exclude cheap database-only actions and export reads.

## Completed infrastructure checks

- [x] Exclude `/api/ai/*` from service-worker caching in `app/sw.ts`.
- [x] Show backend-offline errors in interview and batch-run UI. Active health checks remain unimplemented.
- [x] Include the simulated-persona research-integrity notice in Markdown exports.
