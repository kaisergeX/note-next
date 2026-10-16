# Theme System — Full Palettes (design spec, not implemented)

Goal: user-selectable color palettes ("vibes") that restyle the whole app. Full palettes (Tier 2), not accent-only.

## How it works (zero component changes)

- All components use semantic token utilities (bg-paper, text-ink, …) resolving through `@theme inline` → `:root` vars. A palette = a new block of var values under `[data-theme='<name>']` on `<html>`, plus `[data-theme='<name>'].dark` for its dark values. `@theme inline` passes vars through, utilities re-resolve automatically.
- Fonts stay fixed (Inter + Newsreader). Vibe = color only.
- Note-hue system (`dialog-<hue>`/`prose-<hue>`/picker/shadow/border-theme-<hue>`) is per-note, orthogonal, untouched.

## Data model

- store/system.ts: split current `theme` into `mode` ('light'|'dark', keep prefers-color-scheme fallback) + `palette` (string, default 'paper'). Extend `partialize` in store/index.ts. Same localStorage key.
- theme-wrapper.tsx: apply both — `.dark` class + `data-theme` attribute on `<html>`.

## Vars per full palette (both modes)

--paper, --paper-raised, --ink, --ink-muted, --hairline, --hairline-strong, --accent, --destructive, --success, --ink-hover, --ink-tint, --ink-tint-strong, --raised-hover, --sheet-tint. (~14 vars × 2 modes per palette.)

Derived vars need no per-palette values: `--ink-hover`/`--ink-tint`/`--ink-tint-strong`/`--hairline-strong`/`--raised-hover` are `color-mix()` off `--ink`/`--paper`/`--paper-raised`/`--hairline`; `--sheet-shadow` is built from `--sheet-tint`; `--muted-foreground` maps to `--ink-muted`. The `paper` palette's blocks stay exactly as the current `:root` / `.dark` blocks in app/globals.css.

## Contrast floors (per palette, per mode — from DESIGN.md)

ink/paper > 12:1; ink-muted ≥ 4.5:1. Verify before shipping a palette.

## Implementation touch points

1. globals.css — palette var blocks.
2. store/system.ts + store/index.ts — mode + palette fields.
3. theme-wrapper.tsx — data-theme attribute.
4. Picker UI (user page first; header dropdown optional later) — Button/MenuCustom, tokenized.
5. app/[locale]/global-error.tsx + global-not-found.tsx inline scripts — read palette too, set data-theme before paint.
6. layout.tsx themeColor — static; either keep default palette value or JS-update the meta on palette change (minor).

## Suggested first palettes

- paper (default, current)
- sepia (warm paper, brown-black ink, amber-leaning accent) — first Tier 2 addition.

## Rule that keeps this possible

Migrated code must stay token-only (migration guide rule 3). Raw zinc/red/etc in components is what would break palettes.
