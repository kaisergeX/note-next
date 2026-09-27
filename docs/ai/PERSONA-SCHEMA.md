# Persona Data Model — v1

> **Update note:** `region` and `interview_stance` changed from fixed enums to
> app-validated text (see rationale under each field). This is a schema
> flexibility change, not a v1 scope change — v1 build still targets Vietnam
> only per PRD.md.
>
> **Update note (Phase-3 UX follow-up):** `gender`, `age`, `income_bracket`,
> `occupation`, `interview_stance`, and `quirks_freetext` are now nullable in
> the DB (migration `20260926155752_normal_sunset_bain`) — optional at save
> since the relaxed schema requires only `name` + `region`; drafts may leave
> them for the LLM to invent.
>
> **Update note (pre-UI-rework correction):** `region` is now free text — no
> fixed list, no app-layer validation; per-country plausibility is judged by
> the LLM at generation time. Enumerated attributes (`gender`, `income_bracket`,
> `interview_stance`) store canonical ENGLISH keys (`male`/`female`,
> `low`/`medium`/`high`, `cooperative`/`guarded`/`talkative`/`suspicious`) as
> suggestions with free text allowed — labels live in the dictionaries, the
> server never maps keys to display strings. The `personas` table was cleared
> by the owner for this rework — no data migration.

## Persona

| Field                       | Type                           | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                        | string (uuid)                  |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `name`                      | string                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `gender`                    | string (canonical keys)        | Free text; suggestions are the canonical ENGLISH keys `male` / `female` (custom text allowed; empty = not specified). Stored verbatim — the dictionary maps keys to display labels, the server never does.                                                                                                                                                                                                                                                                                                                                                  |
| `age`                       | number                         |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `locale`                    | string                         | e.g. `vi-VN`. Namespaces which generation conventions apply. **Not the next-intl UI locale** (`locales: ['en','vi']` in `i18n/routing.ts` — that's UI translation only). Validated against the `AI_LOCALES` supported-locale map in `config/ai.ts`. Defaults to `vi-VN` in v1 (only locale in use). Adding a locale later is a config change (new entry in `AI_LOCALES`), not a schema change.                                                                                                                                                              |
| `region`                    | text (free)                    | Free text, max 50 chars. No fixed list and no app-layer validation — the LLM judges per-country plausibility at generation time (uses it when plausible; silently invents a fitting one when not). **Dialect signal only** — drives word choice / tone particles in bio + system-prompt generation. Stored as text, not a DB enum. Deliberately _not_ province-level — see below.                                                                                                                                                                           |
| `income_bracket`            | tag (canonical keys)           | Free text; suggestions are the canonical ENGLISH keys `low` / `medium` / `high` (custom text allowed). Stored verbatim — dictionary maps keys to labels.                                                                                                                                                                                                                                                                                                                                                                                                    |
| `occupation`                | tag                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `background_tags`           | string[]                       | free-solo tag input — type to search existing, or add new. **Province/city lives here** (e.g. "Hải Phòng", "Đà Lạt"), not as a separate field — see rationale below.                                                                                                                                                                                                                                                                                                                                                                                        |
| `personality_sliders`       | object (jsonb)                 | `{calm_anxious: 0-100, optimistic_cynical: 0-100, frugal_spendthrift: 0-100}` — personality-only axes. Interview-behavior axes (`reserved_talkative`, `trusting_guarded`) deliberately live in `interview_stance`, not here — keeping them in both was a contradiction generator for bio drafting ("reserved 90" + stance "talkative"). Money attitude stays because it feeds the "evasive on money" interview behavior the stance field describes. If the axis set changes later, old personas keep old keys — treat missing axes as unset, don't migrate. |
| `interview_stance`          | text (free, presets suggested) | Free text via the same tag/combobox pattern as `background_tags`; suggestions are the canonical ENGLISH keys — cooperative / guarded / talkative / suspicious — shown as suggestions, not a fixed enum; non-matching free text is carried through verbatim. Rationale: the schema already avoids rigid buckets for personality (sliders) and background (free-solo tags); a 4-value stance enum was the odd one out and understates real interview behavior (e.g. "cooperative but evasive on money questions").                                            |
| `quirks_freetext`           | string                         | one or two sentences — a specific memory, speech habit, pet peeve                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `generated_bio`             | string                         | AI-drafted from the above, editable/regeneratable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `system_prompt`             | string                         | derived from `generated_bio` + stance; the authored snapshot of the persona's instructions (compact, persona-unique only — universal speech rules are enforced at runtime by the appended contract, not baked in here). At call time the chat route appends `PERSONA_SPEECH_CONTRACT`, so the full system message = snapshot + contract; this column is never mutated. Snapshot at interview time is stored on the transcript (see Transcript) — the persona may be edited after a run.                                                                     |
| `status`                    | enum                           | `draft` / `active` / `archived`. Bulk candidates arrive as `draft` (swipe-review keep/edit/reroll); `keep` promotes to `active`. Only `active` personas join the roster summary (diversity guard), batch selection, and export. `archived` is the delete mechanism — transcripts reference `persona_id`, so hard delete would orphan or cascade them; archiving sidesteps the FK question entirely.                                                                                                                                                         |
| `created_at` / `updated_at` | timestamp                      |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### Why region stays region-level, not province-level

Region (Bắc/Trung/Nam) is the boundary that actually shows up in spoken
Vietnamese — word choice, tone particles — and is what an LLM can plausibly
imitate. Province is a socioeconomic/lifestyle signal, not a dialect signal
(a rural Nghệ An farmer and a Hanoi office worker share a region but little
else), and most provinces within a region share that region's dialect
anyway. Forcing a 63-way province choice into a structured field would dilute
the one field that actually drives voice, and adds friction to persona
creation for no generation-quality benefit. Province/city instead rides on
`background_tags`, which:

- reuses the combobox UI already built for background traits — no new input
  pattern,
- feeds the diversity guard automatically, since it already reads
  `background_tags` for near-duplicate detection,
- is cheap to promote to a structured field later if it turns out to matter
  enough to need its own filter/facet.

**Build note:** the bio/system-prompt generation prompt template should pull
in `background_tags` for local color the same way it pulls in `region` for
dialect, or the province tag is stored but never actually used.

## Transcript

| Field           | Type                                  | Notes                                                                                                                                                                                                                                         |
| --------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | string (uuid)                         |                                                                                                                                                                                                                                               |
| `persona_id`    | string                                | FK → Persona                                                                                                                                                                                                                                  |
| `run_id`        | string                                | groups transcripts from the same batch/group interview run; null for single/manual chats. Unique together with `persona_id` — a resume/retry must not create duplicate transcripts.                                                           |
| `mode`          | enum                                  | `single` / `group`                                                                                                                                                                                                                            |
| `turns`         | array of `{role, content, timestamp}` | One transcript row per interview _session_; turns appended atomically as each step completes (single-statement JSONB append, `turns = turns \|\| $1::jsonb`).                                                                                 |
| `model`         | string                                | Snapshot of the model identifier used at generation time (e.g. the GGUF filename from the one-line config) — model A/B swaps are a config change, so without this column transcripts from different models are indistinguishable in analysis. |
| `system_prompt` | string                                | Snapshot of the persona's system prompt at interview time — the persona itself may be edited later; the full system message = this snapshot + the runtime-appended `PERSONA_SPEECH_CONTRACT`, so the snapshot is not the whole prompt.        |
| `title`         | string, null                          | Optional display title for the session; auto-generated after the first exchange (language mirrors the conversation) or set/cleared manually; UI falls back to the first user turn's text when null.                                           |
| `created_at`    | timestamp                             |                                                                                                                                                                                                                                               |

Language: v1 chat is Vietnamese-only (per PRD §7). No `language` column yet; when EN chat ships, add it to `transcripts` and `runs` — one migration, no redesign.

Session action semantics: the rename / delete / title actions (`renameInterviewSessionAction`, `deleteInterviewSessionAction`, `generateSessionTitleAction`) are restricted to single-mode transcripts — each guards `run_id === null && mode === 'single'`, so run-linked transcripts are protected (rename/delete on one reject with 'not found'). Delete is an idempotent hard delete: a missing row returns `{deleted: false}` as a success no-op, not an error.

## Run (group/batch interview)

| Field                       | Type          | Notes                                                                                                                                                                                                                    |
| --------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                        | string (uuid) |                                                                                                                                                                                                                          |
| `question_script`           | string[]      | fixed question list used for this run — copied in per run; no reusable named-scripts table in v1 (revisit only if the researcher ends up retyping the same script).                                                      |
| `persona_ids`               | string[]      | which personas were included (the run's full intent; `run_items` tracks what actually happened)                                                                                                                          |
| `status`                    | enum          | pending / in_progress / done / failed. `failed` = fatal (e.g. LM Studio unreachable and the user aborted). A run ending with failed items is `done` + partial flag in the UI — researcher re-runs just the failed items. |
| `created_at` / `updated_at` | timestamp     | `updated_at` doubles as stall detection: `in_progress` with a stale `updated_at` = tab closed mid-run, UI offers resume.                                                                                                 |

## RunItem (per-persona unit of a run)

| Field        | Type                 | Notes                                  |
| ------------ | -------------------- | -------------------------------------- |
| `id`         | string (uuid)        |                                        |
| `run_id`     | string               | FK → Run                               |
| `persona_id` | string               | FK → Persona                           |
| `status`     | enum                 | pending / in_progress / done / failed  |
| `error`      | string, null         | last failure message; cleared on retry |
| unique       | (run_id, persona_id) | resume/retry can't duplicate items     |

This is the unit the browser-driven loop advances — one question-step per call, each well under the route's 60s maxDuration (Hobby platform ceiling: 300s) (see ARCHITECTURE.md "Batch execution model"). A `done` item ⇔ that persona's transcript exists for the run. Failure policy: skip-and-continue; the researcher re-runs only failed items.

## Diversity guard (generation-time, not a stored field)

When generating a new persona (single or bulk), pass a summary of the existing
roster's names + key traits into the generation prompt to steer away from
near-duplicates. Only `active` personas count — drafts (bulk candidates in
review) and archived personas don't. Simple version: names already used + a
short list of (region, occupation, top personality-slider combo) already
represented. `background_tags` (including province, now that it lives there)
should be included in this comparison too, since it's the field most likely to
catch two personas that are only superficially different.

## Export shape

Detail deliberately deferred to build time (per owner decision) — but one
landmine recorded now: CSV must be written **UTF-8 with BOM** or Vietnamese
text opens as mojibake in Excel, which is where the researcher will open it.
Planned flattening: one row per Q&A pair, sliders as one column per axis,
`background_tags` joined with `;`, plus run-level columns (`run_id`, `model`)
when exporting per run.

## Open questions (carried from PRD.md, now partly resolved)

- ~~Region granularity~~ — resolved: region stays coarse (dialect signal),
  province lives in `background_tags`.
- ~~Interview stance: enum or text?~~ — resolved: free text with presets.
- ~~Exact slider set for personality~~ — resolved:
  `calm_anxious` / `optimistic_cynical` / `frugal_spendthrift`; interview
  behavior belongs to `interview_stance`.
- What counts as a "near-duplicate" persona for the diversity guard — name
  only, or name + trait-combo similarity (now including background_tags).

## As-built notes (Phase 0)

The `vi-VN` locale default lives in `config/ai.ts` (`AI_DEFAULT_LOCALE`) and the DB column default; adding a locale means a new `AI_LOCALES` entry only — the Zod locale enum derives from its keys — not a schema change or migration.

Column typing choices as built: `name` varchar(100), `region` varchar(20), `income_bracket` varchar(100), `locale` varchar(20) default 'vi-VN', `background_tags` text[] default empty array, `personality_sliders` jsonb notNull typed `PersonalitySliders` (defined in transcripts.ts). All UUID PKs default to `generate_ulid()`. The `run_items` table has a unique constraint `(run_id, persona_id)` named `run_items_run_persona_unique`.
