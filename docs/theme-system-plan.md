# Appearance Presets — Implementation Plan

**Status:** Phase 2 complete; Phase 3 is next.  
**Spec:** [theme-system.md](theme-system.md)

## Outcome

Users can select a curated appearance preset in the Appearance settings section. Each preset is a complete combination of color, typography, and shape. Users do not mix dimensions or edit individual values. The selected preset and color mode (`system`, `light`, or `dark`) work independently, persist between visits, apply before first paint, and remain usable across supported interface states.

## Phase 1: Confirm decisions and inventory

**Status:** complete.

- **Settings placement:** use the existing user profile settings area. It currently has a `Theme` item with a `#` destination; turn that into the Appearance entry point.
- **Preview:** compact selectable preset cards with a representative surface, interface label, writing sample, and control. A whole-app live preview is deferred.
- **Persistence:** browser-local Zustand persistence is the first-release assumption; there is no account preference persistence in the current store.
- **Mode:** preserve light/dark behavior and make system mode explicit as the default preference.
- **Pre-paint entry points:** normal `ThemeWrapper`, global error, and global not-found each need to resolve the same persisted preference.
- **Representative coverage:** user settings, note list/editor/dialog, AI interview forms/chat, menus, and global error/not-found; review both light and dark modes.
- **Preset direction:** `paper-ink` preserves today's typography and shape. `sepia` shifts the color system warm and uses a softer, rounder shape treatment. Review its coordinated font system in the preview; presets do not need to use the same number of font families.
- **Editor font formatting boundary:** the proposed Word-style `Aa` control applies a font family to selected text and allows multiple fonts within one note. That is a separate rich-text feature, not part of Appearance and not a dependency for it.

### Inventory findings

- `app/globals.css` already centralizes the main color variables and derives hover/tint/shadow values. The radius values are theme tokens (`--radius-sm` through `--radius-xl`), but multiple components use named Tailwind radius utilities and a few use fixed `rounded-full`, `rounded-none`, or `rounded-4xl` geometry.
- `--font-sans` and `--font-serif` are centralized, and `font-serif` is used in content. The app body and global error use the direct `font-inter` class, so they would bypass a preset font-family change until moved to the semantic font role. Current font loading is Inter and Newsreader with Latin subsets; verify English and Vietnamese coverage before adding a font.
- Most shared surfaces use semantic color utilities. Clear hard-coded color exceptions found include the landing page's yellow announcement highlight and the draft badge's amber status treatment. Review these as purposeful status/marketing colors, and convert them to documented semantic tokens if they should adapt to appearance.
- The note hue picker and `dialog-*`/`prose-*`/`picker-*` utilities are intentional per-note colors, not appearance leaks.
- The current settings page is `/[locale]/user`; its Theme entry is a placeholder. Localized settings labels will need translation when the UI is implemented.

### Proposed first-preset art direction

| Preset      | Color                                                                           | Typography                                                                            | Shape                                                                   |
| ----------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `paper-ink` | Preserve current light/dark values.                                             | Inter UI + Newsreader writing.                                                        | Preserve current 6/8/12/16px radius tokens.                             |
| `sepia`     | Warm paper, brown-black ink, amber-leaning accent; matching dark values are in `theme-system.md`. | Inter UI + Newsreader writing, shared with `paper-ink` for Phase 2. | Softer, rounder 8/10/14/20px radii. |

The Phase 2 palette values are recorded in `theme-system.md`. Review them in the preset preview and complete broader contrast coverage in Phase 4.

**Exit condition:** met for the settings, persistence, and code inventory. The preview remains part of Phase 3; broader contrast and visual coverage remain part of Phase 4.

## Phase 2: Add preset and mode foundations

**Status:** complete.

- Preserve current `paper-ink` values and add complete `sepia` values for color, typography, and shape in both modes.
- Keep derived variables centralized; avoid component-specific preset branches.
- Extend persisted system state to separate `mode` and `appearance`.
- Migrate existing stored `theme` choices without changing an explicit user choice.
- Treat missing or invalid values as `mode: 'system'` and `appearance: 'paper-ink'`.
- Update the theme wrapper and pre-paint scripts to apply the same resolved preferences.
- Keep cross-tab storage rehydration consistent with the new persisted fields.

**Exit condition:** met. The preference model, legacy migration, pre-paint bootstrap, OS mode updates, and cross-tab rehydration are implemented. Preset selection UI is intentionally deferred to Phase 3.

## Phase 3: Add Appearance selection and preview

**Status:** not started.

- Add an Appearance section to the user settings page.
- Present each complete preset as one selectable option; do not expose separate color, font, or shape controls.
- Include a compact preview showing representative surfaces, typography, and corner shape for each preset.
- Clearly identify the selected preset and support keyboard use and accessible labels/state.
- Keep color mode controls independent from preset selection.

**Exit condition:** users can understand the preset differences from the preview, select one, and see that mode and appearance are independent.

## Phase 4: Validate visual and accessibility coverage

**Status:** not started.

- Review representative app, note, and AI pages for each preset in both modes.
- Review dialogs, menus, inputs, disabled controls, selection/focus states, and success/destructive feedback.
- Calculate and record required contrast pairs from `theme-system.md`.
- Review typography in supported locales/scripts and at representative sizes.
- Check that shape changes do not clip content or break controls and components.
- Review shared hard-coded styles found in Phase 1 and migrate those that should respond to presets.
- Check global error and not-found rendering with every preset and mode.
- Check narrow viewport and keyboard interaction for the selector and preview.

**Exit condition:** required color pairs pass, readability and geometry are acceptable, preset-specific regressions are resolved, and documented exceptions are intentional.

## First-release acceptance criteria

- `paper-ink` renders the current appearance by default.
- `sepia` is a complete preset with color, typography, and shape treatments in both modes.
- Existing saved explicit light/dark preferences survive migration.
- System mode follows the OS preference and responds when that preference changes.
- Preset and mode persist independently and synchronize across tabs.
- Unknown appearance IDs safely fall back to `paper-ink`.
- The normal app, global error, and global not-found pages apply preferences before paint.
- Appearance settings offer complete preset selection with a compact representative preview.
- Shared UI styles are semantic-token based or documented as intentionally preset-independent.
- Contrast, typography, geometry, and visual review evidence is recorded for both presets and modes.

## Deferred follow-ups

- Account-level preference sync.
- Header shortcut to Appearance settings.
- Full interactive preview.
- Dynamic browser `themeColor` metadata.
- Spacing/density presets, if a clear need emerges.
- Seasonal/event decorations. If pursued later, design them as an optional decorative layer independent of appearance presets and note colors.
- Word-style selected-text font-family formatting in notes. Treat it as a separate rich-text/editor feature.
