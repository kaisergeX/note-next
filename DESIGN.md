---
version: 'alpha'
name: 'Paper & Ink'
description: 'A desk, not a dashboard: warm-cool paper, blue-black ink, serif writing surfaces, one fountain-pen blue accent from the note-hue family, fully mirrored dark mode.'
colors:
  paper: 'oklch(0.972 0.006 90)'
  paper-raised: 'oklch(0.985 0.004 90)'
  paper-dark: 'oklch(0.185 0.012 270)'
  paper-raised-dark: 'oklch(0.225 0.014 270)'
  ink: 'oklch(0.24 0.018 270)'
  ink-dark: 'oklch(0.90 0.008 90)'
  ink-muted: 'oklch(0.44 0.014 270)'
  ink-muted-dark: 'oklch(0.62 0.012 270)'
  hairline: 'oklch(0.895 0.006 90)'
  hairline-dark: 'oklch(0.30 0.014 270)'
  accent: 'oklch(0.50 0.16 255)'
  accent-dark: 'oklch(0.78 0.12 255)'
  danger: 'oklch(0.50 0.19 25)'
  danger-dark: 'oklch(0.70 0.17 22)'
  success: 'oklch(0.45 0.13 155)'
  success-dark: 'oklch(0.72 0.13 152)'
  theme-color: 'oklch(0.972 0.006 90)'
  theme-color-dark: 'oklch(0.175 0.012 270)'
  primary: '{colors.ink}'
  secondary: '{colors.accent}'
  note-card-bg: '#f1f5f9'
  note-card-text: '#1e293b'
  note-swatch: '#94a3b8'
typography:
  display-serif:
    fontFamily: Newsreader
    fontSize: 2.25rem
    fontWeight: 500
    lineHeight: 1.15
  headline-lg:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: 700
  headline-md:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: 700
  headline-sm:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: 600
  note-title:
    fontFamily: Newsreader
    fontSize: 1.25rem
    fontWeight: 600
  prose-body:
    fontFamily: Newsreader
    fontSize: 1.0625rem
    fontWeight: 400
    lineHeight: 1.7
  prose-lg:
    fontFamily: Newsreader
    fontSize: 1.25rem
    fontWeight: 400
    lineHeight: 1.6
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
  body-xs:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: 400
  label-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: 600
rounded:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  full: 9999px
spacing:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  header: 64px
components:
  button-primary:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.paper}'
    typography: '{typography.label-md}'
    rounded: '{rounded.md}'
    padding: 10px
  button-primary-dark:
    backgroundColor: '{colors.ink-dark}'
    textColor: '{colors.paper-dark}'
    typography: '{typography.label-md}'
    rounded: '{rounded.md}'
    padding: 10px
  button-secondary:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.label-md}'
    rounded: '{rounded.md}'
    padding: 10px
  button-ghost:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.label-md}'
    rounded: '{rounded.md}'
    padding: 10px
  button-danger:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.danger}'
    typography: '{typography.label-md}'
    rounded: '{rounded.md}'
    padding: 10px
  button-danger-dark:
    backgroundColor: '{colors.paper-dark}'
    textColor: '{colors.danger-dark}'
    typography: '{typography.label-md}'
    rounded: '{rounded.md}'
    padding: 10px
  input:
    backgroundColor: '{colors.paper-raised}'
    textColor: '{colors.ink}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.md}'
    padding: 8px
  input-dark:
    backgroundColor: '{colors.paper-raised-dark}'
    textColor: '{colors.ink-dark}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.md}'
    padding: 8px
  card:
    backgroundColor: '{colors.paper-raised}'
    textColor: '{colors.ink}'
    rounded: '{rounded.lg}'
    padding: 16px
  card-dark:
    backgroundColor: '{colors.paper-raised-dark}'
    textColor: '{colors.ink-dark}'
    rounded: '{rounded.lg}'
    padding: 16px
  note-card:
    backgroundColor: '{colors.note-card-bg}'
    textColor: '{colors.note-card-text}'
    typography: '{typography.note-title}'
    rounded: '{rounded.lg}'
    padding: 16px
  menu:
    backgroundColor: '{colors.paper-raised}'
    textColor: '{colors.ink}'
    typography: '{typography.label-md}'
    rounded: '{rounded.md}'
    padding: 8px
  dialog:
    backgroundColor: '{colors.paper-raised}'
    textColor: '{colors.ink}'
    rounded: '{rounded.lg}'
    padding: 16px
  chat-bubble-user:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.paper}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.xl}'
    padding: 8px
  chat-bubble-user-dark:
    backgroundColor: '{colors.ink-dark}'
    textColor: '{colors.paper-dark}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.xl}'
    padding: 8px
  chat-bubble-assistant:
    backgroundColor: '{colors.paper-raised}'
    textColor: '{colors.ink}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.xl}'
    padding: 8px
  chat-bubble-assistant-dark:
    backgroundColor: '{colors.paper-raised-dark}'
    textColor: '{colors.ink-dark}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.xl}'
    padding: 8px
  status-badge:
    backgroundColor: '{colors.paper-raised}'
    textColor: '{colors.ink}'
    typography: '{typography.body-xs}'
    rounded: '{rounded.full}'
    padding: 8px
  app-header:
    height: 64px
    padding: 16px
  link:
    textColor: '{colors.accent}'
    typography: '{typography.body-sm}'
  link-dark:
    textColor: '{colors.accent-dark}'
    typography: '{typography.body-sm}'
---

# Paper & Ink — Note Next Design System

## Overview

Concept: **a desk, not a dashboard**. Note Next is a writing app; the interface should feel like fine stationery on a quiet desk — warm-cool paper surfaces, blue-black ink, one fountain-pen blue accent, and the writing surface (serif prose in the note editor) as the single hero. Chrome stays quiet so words stand out.

- **Notes** (`/eton/*`): paper surfaces, pastel per-note colorways (the 12-hue system, unchanged — it is the identity's playful layer), Tiptap editing in serif.
- **AI** (`/ai/*`): same paper system, no pastels, utilitarian forms, messenger chat in sans.
- Stack: Next.js 16, Tailwind CSS 4, custom primitives (native Popover API menus, `<dialog>`-based modals). No component library.

Boldness is spent in exactly one place: the writing surface (serif prose, generous measure, calm margins). Everything else — chrome, buttons, forms — stays disciplined and nearly invisible.

## Colors

Two modes, fully mirrored. Neutrals are warm-cool "laid paper" (slightly warm light mode, blue-black-tinted dark mode) — deliberately NOT cream, NOT pure gray.

| Token        | Light           | Dark                   | Usage                                                                       |
| ------------ | --------------- | ---------------------- | --------------------------------------------------------------------------- |
| paper        | warm off-white  | deep blue-black        | page background                                                             |
| paper-raised | +1 step lighter | +1 step lighter        | cards, inputs, menus, dialogs — anything that sits ON paper                 |
| ink          | blue-black      | warm white             | all primary text                                                            |
| ink-muted    | mid blue-gray   | mid gray               | secondary text, placeholders, meta                                          |
| hairline     | warm gray line  | dark line              | 1px borders everywhere; never black borders                                 |
| accent       | deep blue       | light blue             | links, focus rings, active/selection states, brand marks — NOT button fills |
| danger       | deep crimson    | brighter red           | destructive text/borders; hover fill uses white text                        |
| success      | deep green      | brighter green         | sync/check states                                                           |
| theme-color  | = paper         | darker than paper-dark | browser chrome, iOS splash                                                  |

Rules:

- Primary actions are **ink on paper** (solid ink button), not accent-colored. Accent is for attention (links, focus, selection), never for volume.
- The accent hue belongs to the note-hue family (blue), tying UI to the note colorways; brand marks move to accent blue.
- Empty/fancy states use the **dot-grid motif**: 1px hairline dots on a 16px grid (graph paper), not color gradients.
- Prose links: accent, underlined on hover only.
- Token aliases: `primary` = ink (solid action), `secondary` = accent (attention). Tools that expect a `primary` color get the ink action color, not the accent.

## Typography

Two families, strictly separated:

- **Inter** — all UI chrome: buttons, forms, menus, nav, meta, chat. Loaded via `next/font`.
- **Newsreader** (Google Fonts, variable, optical sizing) — the voice of writing: note titles, note prose, note-card previews, marketing display text. This pairing is the identity; serif means "you are reading/writing".

| Token         | Family     | Size / Weight           | Used for                            |
| ------------- | ---------- | ----------------------- | ----------------------------------- |
| display-serif | Newsreader | 2.25rem / 500, lh 1.15  | marketing hero                      |
| headline-lg   | Inter      | 1.5rem / 700            | page h1 at `sm:`                    |
| headline-md   | Inter      | 1.25rem / 700           | page h1 base                        |
| headline-sm   | Inter      | 1.125rem / 600          | h2, section titles                  |
| note-title    | Newsreader | 1.25rem / 600           | note titles, note-card titles       |
| prose-body    | Newsreader | 1.0625rem / 400, lh 1.7 | note body text                      |
| prose-lg      | Newsreader | 1.25rem / 400, lh 1.6   | large prose contexts                |
| body-md       | Inter      | 1rem / 400              | chat transcript, long sans text     |
| body-sm       | Inter      | 0.875rem / 400          | dominant UI text                    |
| body-xs       | Inter      | 0.75rem / 400           | meta, pills, counters               |
| label-md      | Inter      | 0.875rem / 600          | buttons, menu items, inputs' labels |

Prose measure: cap writing surfaces at ~70ch, centered in their container. Weights in use: Inter 400/500/600/700; Newsreader 400/500/600 (+ italic for quotes/em). No third family, no all-caps eyebrows, no tracked-out labels.

## Layout

- Page gutter `p-4`; AI list/form pages: `container mx-auto` + `space-y-4`.
- Global header: sticky, 64px, solid paper with hairline bottom border; adds a soft sheet shadow only after scroll. Hides on scroll-down, returns on scroll-up.
- Notes list: CSS masonry — `repeat(auto-fill, minmax(min(17rem, 100%), 1fr))` + `grid-rows-[masonry]`, gap-4.
- AI chat: two-pane flex — sidebar `basis-1/4 max-w-md` hairline right border; mobile: 85vw drawer + top bar.
- Editors: sticky top bars, sticky bottom toolbars; full-page note wraps content in a rounded-xl sheet on `sm:`.
- Safe areas: `env(safe-area-inset-*)` on body top, composer bottoms, affixes; `viewportFit: cover`.
- Scroll: `scrollbar-gutter: stable`, `scroll-pt-16`, slim custom scrollbars, smooth.
- Empty states: dot-grid paper, centered serif invitation + one action.

## Elevation & Depth

One elevation signature, used sparingly — **sheet lift**: a soft two-layer shadow (tight 1px contact + wide diffuse) plus a hairline ring. Reserved for: menus, dialogs, sticky bars/toolbars, the scrolled header. Shadows tint with ink (blue-black), never pure black.

- Cards: flat, hairline border, no resting shadow; `hover:`/`focus-within:` lifts via sheet shadow.
- Note cards keep their hue-tinted shadows (`hue-500/20`) — the colorways' signature.
- Dialogs: native `<dialog>`, backdrop = paper at 50% + blur; dialog sheet gets full lift.
- Directional sticky-bar shadows allowed for bars/toolbars glued to an edge.

## Shapes

Radius carries hierarchy (never one radius for everything):

| Token          | Value | Used for                                        |
| -------------- | ----- | ----------------------------------------------- |
| `rounded.sm`   | 6px   | small controls: checkbox, radio, kbd, tag input |
| `rounded.md`   | 8px   | buttons, inputs, menus, tooltips                |
| `rounded.lg`   | 12px  | cards, dialogs, sheets                          |
| `rounded.xl`   | 16px  | note sheets, chat bubbles                       |
| `rounded.full` | pill  | status pills, avatars, swatches, icon buttons   |

Hairline 1px borders dominate; icon-only buttons are circles. Chat bubbles keep one squared tail corner. Note cards may flatten to pill swatches when hue-coded.

## Components

- **Buttons** — five variants × three sizes + icon buttons. Sizes: sm 32px (text-xs), md 40px default (body-sm/600), lg 48px (body-md/600); icon variants are square (40/32px). Primary: solid ink fill, paper text; hover lightens fill ~12%; active returns to base ink and presses down 1px. Secondary: paper-raised fill, hairline border; hover darkens border + tints fill. Ghost: transparent; hover ink 6% tint. Danger: ghost with danger text/border; hover fills danger with paper text. Link: accent text, underline on hover, no padding. States: focus-visible = 2px accent ring offset 2px; disabled = opacity 0.45 + not-allowed; loading = spinner replaces the leading icon, `aria-busy="true"`, interaction off, width preserved. Buttons are flat — no shadows; the press IS the feedback. Rules: one primary per view region; icon-only buttons carry `aria-label`; danger only for destructive confirms; buttons never use accent color (accent = attention, ink = action).
- **Inputs** — paper-raised fill, hairline border, rounded-md, px-3 py-2, body-sm; focus: accent border + 2px accent ring at 25% alpha. One shared implementation; labels above (body-xs, ink-muted), errors below in danger with `role="alert"`.
- **Cards** — paper-raised, hairline border, rounded-lg, p-4; note cards recolor via hue classes and may drop the border.
- **Menus/popovers** — `PopoverBase`/`MenuCustom` on the native Popover API + CSS anchor positioning; menu sheet = paper-raised, rounded-md, lift shadow; items p-3 rounded-sm, hover paper-raised-on-paper (subtle ink 6% tint), arrow-key roving focus required.
- **Dialogs** — native `<dialog>`, rounded-lg, lift shadow, backdrop paper/50 + blur; header/content/footer p-4; destructive confirmations use button-danger.
- **Badges** — status pills: pill radius, paper-raised fill, hairline border, body-xs, role-colored text (amber draft, green active, ink-muted archived).
- **Chat** — user bubble: ink fill, paper text; assistant: paper-raised + hairline; both rounded-xl with one tail corner, body-sm sans; composer: paper-raised input with inner Send/Stop, sticky hairline-top bar.
- **Tiptap toolbars** — sans UI: menu sheet with button-icon toggles (active = ink 10% tint), fixed/bubble/floating modes.
- **Theme picker** — popover of the 12 hue circles (28px, `rounded-full`), active swatch gets accent ring.
- **Loading** — brand mark pulse for route loads; small inline spinners for actions; `animate-pulse` skeletons for lists; 3 bouncing typing dots in chat.
- **Errors/feedback** — inline `role="alert"` in danger below the control; async success uses `role="status"`; no toast system until needed (then: bottom-center sheet-lift banner, `role="status"`).

## Do's and Don'ts

Do:

- Reach for paper/paper-raised/ink/hairline tokens first; hue pastels only for note surfaces.
- Pair every light token with its dark mirror; test both modes.
- Reserve serif for writing surfaces; if it's chrome, it's Inter.
- Use accent for attention (links, focus, selection, active), ink for action (primary buttons).
- Keep elevation rare: flat cards, lifted sheets.
- Cap prose at ~70ch.
- Use the wired token utilities (`bg-paper`, `text-ink`, `border-hairline`, `shadow-sheet`, `font-serif`) and the primitives in `components/ui/`.

Don't:

- Don't add a third font family, all-caps eyebrows, or tracked-out labels.
- Don't put accent color on large surfaces or primary button fills.
- Don't use pure black/white or pure gray — neutrals always carry the paper/ink tint.
- Don't stack shadows on flat cards; lift only floating things.
- Don't color AI pages with note hues; pastels belong to notes.
- Don't invent new radii; the five-step scale covers all cases.
- Don't generate Tailwind v3-era syntax (`tailwind.config.*`, `content`/`safelist` arrays, `darkMode` key) — this repo is Tailwind 4 CSS-first: `@theme`, `@utility`, `@custom-variant`, `@plugin`, `@source inline`.

## Dark Mode

Class-based: `.dark` on `<html>` via `@custom-variant dark (&:where(.dark, .dark *))`; Zustand persisted store with `prefers-color-scheme` fallback. Dark mode is "lamp-lit desk": blue-black paper, warm-white ink — never gray-on-gray. Every token has a `-dark` mirror; surfaces step up (paper → paper-raised) instead of using overlays. Browser chrome follows `theme-color`.

## Note Colorways

Unchanged and protected — the 12 DB-backed hues (slate, zinc, stone, red, orange, yellow, green, cyan, blue, purple, pink, rose) × 5 roles, generated by `config/tailwindTheme.ts`, safelisted via `@source inline`:

- `dialog-<hue>`: surface hue-100 + text hue-800 (dark: /80)
- `prose-<hue>`: serif typography palette for note content (update with Newsreader)
- `picker-<hue>`: swatch hue-400
- `shadow-theme-<hue>`: hue-500/20 shadow
- `border-theme-<hue>`: hue-400 border

Pastels live only on notes. When prose moves to Newsreader, `prose-<hue>` weights map to Newsreader's 400/600 and italics for quotes.

## Motion

Restrained, action-answered, scroll-aware; no animation plugin, hand-rolled `@keyframes`:

- Scroll-driven: sticky-bar shadows, affix appearance via `animation-timeline: scroll()`.
- Menus: `@starting-style` scale 0.97→1 + fade, 100ms ease-out, `allow-discrete`.
- Buttons: press-down 0.5px on active; no hover scale.
- Chat: 3 bouncing dots, 1.2s infinite.
- Note navigation: `ViewTransition`.
- Non-user-triggered motion: one orchestrated moment max per page (route-load mark pulse). Respect `prefers-reduced-motion`: disable scroll-driven and looping animations.

## Accessibility

Commitments for the custom-primitives stack (no component library):

- Keyboard: every menu supports Arrow/Home/End + typeahead (roving focus); comboboxes implement `aria-expanded`, `aria-activedescendant`, arrow navigation, selection announcement (WAI-ARIA APG patterns).
- Dialogs: native `<dialog>` focus trap + Escape + focus restore; `aria-labelledby` on every dialog.
- Live regions: errors `role="alert"`, async success `role="status"`; never communicate state by color alone.
- Focus: visible 2px accent ring on all interactive elements (`focus-visible`), never removed.
- Contrast: ink on paper and paper on ink exceed 12:1; ink-muted text minimum 4.5:1 in both modes; hue-800 on hue-100 note pairs verified per hue.
- Touch targets ≥ 40px on mobile; `prefers-reduced-motion` respected.
- When a hand-rolled widget's keyboard/a11y cost exceeds its visual uniqueness, adopt headless behavior libs (`@react-aria` hooks or `@base-ui/react`) for that widget only — visuals stay custom.
