# Design Migration Guide — Paper & Ink

Operational guide for migrating the app's UI to the approved design system, one route chunk per thread.

- **Source of truth:** `DESIGN.md` (repo root) — read it first, always.
- **Baseline:** `docs/design-audit.md` — old→new context, inconsistency backlog, decisions.
- **This doc:** what each migration thread does, in what order, and how to verify.

## Rules (every thread)

1. Read `DESIGN.md`, `docs/design-audit.md`, and this doc before touching code.
2. Migrate ONLY your assigned chunk. Other chunks stay untouched.
3. No raw zinc/red/gray/amber hex or Tailwind raw color classes in migrated code — token utilities only (see cheat sheet). Note-hue classes (`dialog-<hue>`, `prose-<hue>`, `picker-<hue>`, `shadow-theme-<hue>`, `border-theme-<hue>`) are protected and stay.
4. No legacy classes in touched code (`bg-default`, `button*`, `card`, `glass`, `shadow-theme`, `text-danger`, `bg-theme`, `bg-reverse`, `text-gradient`). Mapping below.
5. Tailwind 4 syntax only (see AGENTS.md "Design System"). Never generate v3 syntax.
6. Use the primitives in `components/ui/` (`Button`, `Input`, `Badge`) instead of hand-rolled classes for buttons/inputs/badges.
7. Dark mode needs no `dark:` pairs for token colors — vars flip automatically. Only non-token colors (e.g. amber pill text) keep explicit `dark:` pairs.
8. Do NOT edit `DESIGN.md` in a migration thread. If the design is wrong for a case, stop and ask the owner.
9. Verify per thread: `pnpm lint` + `pnpm build` + visual check (both light/dark, desktop + mobile).
10. `git status --porcelain` must show only your chunk's files (plus docs). Report and stop at chunk end.

## Token cheat sheet

Semantic utilities (defined in `app/globals.css` via `:root`/`.dark` + `@theme inline`):

| Utility                                                                   | Role                                                        |
| ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `bg-paper` / `text-paper`                                                 | page surface / text on ink fills                            |
| `bg-paper-raised`                                                         | cards, inputs, menus, dialogs                               |
| `bg-ink` / `text-ink`                                                     | ink fill / primary text                                     |
| `text-ink-muted`                                                          | secondary text, placeholders, meta                          |
| `border-hairline` / `border-hairline-strong`                              | 1px borders / hovered borders                               |
| `text-accent` / `border-accent/40` / `ring-accent`                        | links, focus, selection, active states — never button fills |
| `bg-destructive` / `text-destructive` / `bg-success` / `text-success`     | danger / success                                            |
| `bg-ink-hover` / `bg-ink-tint` / `bg-ink-tint-strong` / `bg-raised-hover` | hover/active tints                                          |
| `shadow-sheet`                                                            | the one elevation signature (menus, dialogs, sticky bars)   |
| `font-serif`                                                              | Newsreader — writing surfaces only                          |
| `bg-dotgrid`                                                              | dot-graph-paper empty-state motif                           |

Primitives:

- `<Button variant="primary|secondary|ghost|danger|link" size="sm|md|lg" iconOnly loading>` — one primary per view region; icon-only needs `aria-label`; danger only for destructive confirms.
- `<Input invalid>` — `invalid` switches border/ring to destructive and sets `aria-invalid`.
- `<Badge status="draft|active|archived|accent|neutral" dot>` — status pills.

## Old → New mapping

| Old                                                                             | New                                                                                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `bg-default` page surface                                                       | `bg-paper` + `text-ink`                                                                                                        |
| `card` class                                                                    | `bg-paper-raised border border-hairline rounded-lg`                                                                            |
| `button` / `button-secondary` / `button-danger` / `button-icon` / `button-base` | `<Button variant size iconOnly>`                                                                                               |
| `button-affix`                                                                  | `Button` (ghost/secondary) + `fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))]` positioning kept as plain classes |
| `text-danger`                                                                   | `text-destructive`                                                                                                             |
| `text-zinc-500` / `text-muted-foreground`                                       | `text-ink-muted`                                                                                                               |
| `glass`                                                                         | `bg-paper/70 backdrop-blur-sm`                                                                                                 |
| `shadow-theme`                                                                  | `shadow-sheet`                                                                                                                 |
| `bg-theme` + `main.bg-fancy`                                                    | `bg-dotgrid`                                                                                                                   |
| `bg-reverse`                                                                    | `bg-ink text-paper`                                                                                                            |
| `text-gradient` wordmark                                                        | `text-accent`                                                                                                                  |
| Tiptap prose (Inter)                                                            | `font-serif` + existing `prose`/`prose-<hue>` (update weights to Newsreader 400/600, italics for quotes)                       |
| bare `h-11`/`h-fit` icon buttons                                                | `<Button iconOnly>`                                                                                                            |
| inline `inputClass` strings                                                     | `<Input>`                                                                                                                      |
| hand-rolled status pill spans                                                   | `<Badge status>`                                                                                                               |
| `disabled` utility on interactive elements                                      | `disabled` attribute + `disabled:opacity-45 disabled:cursor-not-allowed` classes (or primitive props)                          |

## Threads (in order — chrome first, so later threads inherit it)

### Thread 1 — App chrome

Files: `app/[locale]/layout.tsx`, `components/layouts/theme-wrapper.tsx` (Newsreader already wired — verify only), `components/layouts/app-header.tsx`, `components/layouts/scroll-top-button.tsx`, `components/layouts/logo-loading.tsx`, `components/layouts/provider-wrapper.tsx` (verify only), `app/[locale]/error.tsx`, `app/[locale]/global-error.tsx`, `app/[locale]/not-found.tsx`, `app/[locale]/global-not-found.tsx`, `app/[locale]/denied/**`, `app/[locale]/login/page.tsx`.
Notes: header `glass` → `bg-paper/70 backdrop-blur-sm` + `border-hairline` bottom; add sheet shadow on scroll (keep existing scroll-driven animation, retint to ink); wordmark → `font-serif` + `text-accent` (plain, no gradient); theme toggle + avatar/menu buttons → `<Button iconOnly>`/MenuCustom kept; error/not-found/denied split-header layout stays, colors tokenized.
Accept: no zinc hex in these files; header reads as paper with hairline in both modes.

### Thread 2 — Notes list

Files: `app/[locale]/(note)/eton/page.tsx`, `components/note/note-tiny.tsx`, `components/note/note-create.tsx`.
Notes: empty state `bg-fancy`/`bg-theme` → `bg-dotgrid`; masonry grid classes stay; NoteTiny keeps `dialog-<hue>`/`shadow-theme-<hue>`, border/borderless per DESIGN; create button → `<Button>` (secondary; keep `btn-light-sweep` but recolor its gradient to accent-blue/ink tints in globals).
Accept: list + empty state match DESIGN.md; note cards unchanged visually except borders/typography tokens.

### Thread 3 — Note editor

Files: `components/note/note-dialog.tsx`, `components/note/note-detail.tsx`, `components/note/note-editor.tsx`, `components/note/note-customize.tsx`, `components/note/note-theme-picker.tsx`, `app/[locale]/(note)/full/eton/[id]/page.tsx`, plus the `.k-dialog` block in `globals.css`.
Notes: dialog surface tokens (`bg-paper-raised`, `border-hairline`, `shadow-sheet`, backdrop `bg-paper/50 + blur`); title editor → `font-serif` (note-title weight); directional sticky shadows keep, retint to ink; NoteCustomize bar → tokens; keep the whole note-hue recolor system untouched.
Accept: editor reads as paper sheet; hue picker and colorways behave exactly as before.

### Thread 4 — AI roster + forms

Files: `app/[locale]/ai/interview/page.tsx`, `new/page.tsx`, `[id]/edit/page.tsx`, `[id]/page.tsx`, `layout.tsx` (verify only), `components/ai/interview/persona-form.tsx`, `persona-roster-card.tsx`, `persona-draft-card.tsx`, `persona-combobox.tsx`, `persona-tags.tsx`, `persona-slider.tsx`, `persona-bio-panel.tsx`, `start-interview-button.tsx`.
Notes: ALL inline `inputClass` copies → `<Input>`; status pills → `<Badge status>`; sliders `accent-zinc-*` → `accent-accent`; buttons → `<Button>`; error `<p role="alert">` → `text-destructive`; cards → tokens; combobox listbox → PopoverBase-based or at minimum tokenized + keyboard per DESIGN.md Accessibility (arrow/Home/End, `aria-activedescendant`).
Accept: zero `inputClass` strings remain; roster/profile render on paper with no zinc.

### Thread 5 — AI chat

Files: `components/ai/interview/persona-chat-shell.tsx`, `persona-chat.tsx`, `chat-messages.tsx`, `chat-bubble.tsx`, `chat-input.tsx`, `session-row.tsx`.
Notes: bubbles → ink fill (user) / `bg-paper-raised border-hairline` (assistant), tail corners kept, `text-sm` sans; composer → `<Input>`-styled shell or token classes + `<Button>`; sidebar/drawer → `border-hairline`, active session `bg-ink-tint`; typing dots keep, recolor `bg-ink-muted`.
Accept: chat matches DESIGN.md Components (Chat) in both modes.

### Thread 6 — AI runs + bulk

Files: `app/[locale]/ai/interview/runs/page.tsx`, `runs/new/page.tsx`, `runs/[runId]/page.tsx`, `components/ai/interview/run-new-form.tsx`, `run-loop.tsx`, `run-transcript.tsx`, `bulk-draft-workbench.tsx`, `run-status.ts`.
Notes: `RUN_STATUS_BADGE_CLASS` map → `<Badge status>` values (map old statuses: draft→draft, active/completed→active, archived/failed/expired→archived, others→neutral; ask owner if unclear); forms → `<Input>`; buttons → `<Button>`; progress/skeletons → `bg-ink-tint` tokens.
Accept: runs pages consistent with roster; no legacy classes.

### Thread 7 — Misc + final cleanup

Files: `app/[locale]/user/page.tsx`, `app/[locale]/admin/**`, `app/[locale]/trust/privacy/page.tsx`, `app/[locale]/page.tsx` (marketing home), `components/table.tsx`, `components/table-placeholder.tsx`, `components/expanding-arrow.tsx`, `components/refresh-button.tsx`.
Then cleanup (only after ALL threads done and owner confirms):

1. In `globals.css`, remove retired utilities: `bg-default`, `bg-theme`, `bg-reverse`, `button-base`, `button`, `button-secondary`, `button-danger`, `button-icon`, `button-affix`, `card`, `card-fancy`, `glass`, `shadow-theme`, `ring-theme`, `ring-reverse`, `text-danger`, `text-gradient`, `btn-light-sweep` (if recolored sweep kept in Thread 2, keep it). Keep: `flex-center*`, `scrollbar*`, `typing-dot`, `animate-*`, `prose`, note-hue plugin classes, `position-*`, `bg-dotgrid`, new token layer.
2. Repo-wide grep: `bg-default|button-secondary|text-danger|shadow-theme(?!-)|glass|bg-theme|bg-reverse|text-gradient|zinc-|gray-|slate-` in app/ + components/ — expect only note-hue plugin internals + DESIGN/docs. Fix stragglers.
3. Final: `pnpm lint` + `pnpm build` + full ui-reviewer pass (all key routes, both modes) + owner sign-off.
4. Delete this guide (design-audit.md stays as record).

## Per-thread checklist (copy into each thread's plan)

- [ ] Read DESIGN.md + docs/design-audit.md + docs/design-migration.md
- [ ] Grep chunk files for legacy classes + raw zinc/red/gray values; replace per mapping
- [ ] Use `<Button>`/`<Input>`/`<Badge>` primitives
- [ ] Keep `dialog-<hue>` / `prose-<hue>` / `picker-<hue>` / `shadow-theme-<hue>` / `border-theme-<hue>`
- [ ] `pnpm lint` && `pnpm build`
- [ ] Visual check: light + dark, desktop + mobile
- [ ] `git status --porcelain` shows only this chunk + docs
- [ ] Report changes; stop (next chunk = new thread)

## Instructions

First read DESIGN.md, docs/design-audit.md, and docs/design-migration.md — follow the rules, mapping, and per-thread checklist exactly. Migrate only selected thread's chunk to token utilities and components/ui primitives; note-hue classes stay untouched. Do not edit DESIGN.md.
