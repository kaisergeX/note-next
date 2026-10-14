# UI Audit & Migration Baseline — note-next

The original full audit (2026-10-14) found the app's UI built ad-hoc. After review, the owner approved the "Paper & Ink" system — see `DESIGN.md` (source of truth) — and the token layer is wired in `app/globals.css`. This doc is now the migration baseline: what was inconsistent, how old classes map to the new system, decisions made, and the route-by-route plan. Historical detail lives in git history.

## Snapshot (pre-migration)

Next.js 16, Tailwind 4.3 CSS-first + (formerly) a legacy v3 `tailwind.config.mjs` (now deleted), Inter only, class dark mode via Zustand, `@tabler/icons-react`, `@kaiverse/k` Dialog, hand-rolled native-Popover menus. Notes feature (`/eton/*`) playful with 12 pastel note hues (kept as-is); AI feature (`/ai/*`) utilitarian zinc. Old styling lived as inline zinc/red values + custom `@utility` classes in `globals.css`.

## Inconsistencies (migration backlog)

1. Text inputs duplicated 7× as an inline class string — canonical was `persona-form.tsx:151-152`; copies at persona-combobox.tsx:130, persona-tags.tsx:95, persona-bio-panel.tsx:52,90, run-new-form.tsx:136, bulk-draft-workbench.tsx:202,219, session-row.tsx:167 → replace with `components/ui/input.tsx`.
2. Two badge systems — `components/ui/badge.tsx` (old, `rounded-xl bg-reverse`) vs hand-rolled status pills (persona-roster-card.tsx:110-114, persona-draft-card.tsx:135-137, run-transcript.tsx:47-51, run-status.ts:8-13, persona-chat-shell.tsx:149-151) → replace both with new `Badge` (status map).
3. Three menu mechanisms — `PopoverBase`/`MenuCustom` (keep), `PersonaCombobox` absolute listbox (persona-combobox.tsx:132-159), `PersonaTags` native `<datalist>` (persona-tags.tsx:97-103) → converge on PopoverBase; combobox a11y upgrade per DESIGN.md Accessibility.
4. Error text blocks duplicated 7+× (`role="alert"` inline `<p>`) → extract a small `FieldError` or keep pattern but tokenized (`text-destructive`); no toast system.
5. Icon sizing: 3 conventions (`1.2rem`, 14/16/18px, default 24) + 2 CSS overrides → standardize 16px UI / 14px sm / 18px lg.
6. Muted text: token `text-muted-foreground` bypassed by ad-hoc `text-zinc-500` → `text-ink-muted` everywhere.
7. Menu row padding p-4 vs p-3 → standardize.
8. Icon-only/close buttons: 4 treatments → Button `iconOnly`.
9. ~55 arbitrary Tailwind values — mostly justified (safe-area insets, masonry, directional sticky shadows); leave unless tokenizable.
10. AI confirm dialogs repeat Header/Content/Footer cancel-confirm markup 5× (persona-draft-card.tsx:235,269, session-row.tsx:210, run-new-form.tsx:272, persona-roster-card.tsx:167) → extract `ConfirmDialog`.
11. `RefreshButton` bypasses button system (components/refresh-button.tsx:15) → Button ghost/link.
12. Loading: 3 patterns (LogoLoading, spinners, pulse skeletons) — acceptable; document only.
13. `k-components` CSS layer declared empty in globals.css — remove or use.

## Old → New mapping

| Old (until migrated)                                                                             | New (target)                                                                                                                |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `bg-default` page surface                                                                        | `bg-paper` on page + `text-ink`                                                                                             |
| `card` class                                                                                     | `bg-paper-raised border border-hairline rounded-lg` (or future Card primitive)                                              |
| `button` / `button-secondary` / `button-danger` / `button-icon` / `button-base` / `button-affix` | `<Button variant size iconOnly>` from `components/ui/button.tsx`                                                            |
| `text-danger`                                                                                    | `text-destructive`                                                                                                          |
| `text-zinc-500` / `text-muted-foreground`                                                        | `text-ink-muted`                                                                                                            |
| `glass`                                                                                          | `bg-paper/70 backdrop-blur-sm` pattern                                                                                      |
| `shadow-theme`                                                                                   | `shadow-sheet`                                                                                                              |
| `bg-theme` + `main.bg-fancy` gradient pages                                                      | `bg-dotgrid` empty-state motif                                                                                              |
| `bg-reverse`                                                                                     | `bg-ink text-paper`                                                                                                         |
| `text-gradient` (rose→violet wordmark)                                                           | `text-accent` wordmark                                                                                                      |
| Inter-only prose                                                                                 | `font-serif` (Newsreader) for writing surfaces                                                                              |
| `dialog-<hue>` / `prose-<hue>` / `picker-<hue>` / `shadow-theme-<hue>` / `border-theme-<hue>`    | UNCHANGED — note colorways are protected (plugins: config/tailwindNoteThemePlugin.mjs, config/tailwindTypographyPlugin.mjs) |

## Decisions (2026-10-14)

1. `DESIGN.md` is a designed system ("Paper & Ink"), not a mirror of the old UI. Owner confirmed the old UI was ad-hoc; bg + buttons were unsatisfying.
2. Component stack: custom primitives, no shadcn/Base UI adoption. Headless behavior libs (`@react-aria` hooks / `@base-ui/react`) may be adopted per-widget only where hand-rolled a11y cost exceeds visual uniqueness (combobox, menus). Native Popover API menus + `<dialog>` modals stay.
3. Typography: Newsreader (serif, writing surfaces) + Inter (UI chrome).
4. Accent: Fountain-pen Blue — `oklch(0.50 0.16 255)` light / `oklch(0.78 0.12 255)` dark, picked from live candidates; violet rejected.
5. Buttons rebuilt from scratch: 5 variants × 3 sizes + icon buttons, flat tactile press, full state coverage; legacy `button*` classes retired on migration.
6. Token layer wired: `:root`/`.dark` vars + `@theme inline` in globals.css; `tailwind.config.mjs` deleted (headlessui safelist was dead weight — no source usage); note-theme plugins load via `@plugin` wrappers.
7. Primitives: `components/ui/{button,input,badge}.tsx` — server-compatible, no cva.
8. Future selective adoption, if ever: shadcn + **Base UI** (its July 2026 default), not Radix.

## Migration plan

Route-by-route migration is operationalized in **`docs/design-migration.md`** (thread order, per-thread scope and acceptance criteria, checklist, kickoff prompt). Follow that doc; this file stays the audit baseline and decision record.
