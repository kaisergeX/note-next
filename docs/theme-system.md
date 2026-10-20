# Appearance Presets

**Status:** Phase 2 complete; Appearance selection and preview remain pending (Phase 3).
**Scope:** curated, full-app appearance presets

## Goal

Let users choose a curated appearance preset for the app. Each preset defines a coherent visual identity across color, typography, and shape, and supports both light and dark mode. Users select among complete presets; they do not mix dimensions or edit individual values.

The settings section is called **Appearance**. This is a preset selector, not user customization. “Vibe” can be used informally, but should not be the data model or settings label.

## Product boundaries

- A user's selected preset persists across visits and applies throughout the app.
- Light/dark/system mode remains an independent preference applied to the selected preset.
- The existing per-note hue system remains independent and unchanged.
- Seasonal or event decorations are a separate future feature. They must not silently change a user's preset or note colors.
- The initial persistence model is the existing browser-local Zustand store. Account sync is out of scope unless product requirements change.

## Preference model

Keep color mode and appearance preset as separate preferences:

- `mode`: `'system' | 'light' | 'dark'`; default is `'system'`.
- `appearance`: a validated preset ID; default is `'paper-ink'`.

The effective mode is the explicit light/dark choice, or the current `prefers-color-scheme` value when mode is `system`. Store only the user's preference, not a second derived effective-mode value.

Existing storage currently has an optional `theme` value (`'light' | 'dark'`). Migration must preserve an existing explicit choice as `mode`, map a missing choice to `system`, and default an absent or unknown appearance ID to `paper-ink`. Keep the current storage key unless implementation reveals a compatibility reason to change it. Cross-tab storage updates should continue to work.

## Preset contract

Components consume semantic CSS variables through the Tailwind `@theme inline` mappings in `app/globals.css`. Each preset supplies a coherent set of semantic values for color, typography, and shape. Keep values centralized and derived where practical; avoid component-specific preset branches.

Use one explicit selector contract on `<html>`:

- Default appearance values remain the current `:root` values for `paper-ink`.
- Non-default light values use `html[data-appearance='<id>']`.
- Non-default dark values use `html.dark[data-appearance='<id>']`.
- `.dark` continues to represent effective dark mode for existing dark-mode selectors.

Check the exact selectors against cascade order when implemented. A missing or unknown `data-appearance` must render as `paper-ink`.

### Appearance dimensions

Each preset defines these dimensions:

- **Color:** `--paper`, `--paper-raised`, `--ink`, `--ink-muted`, `--hairline`, `--accent`, `--destructive`, `--success`, and `--sheet-tint`, for both light and dark modes.
- **Typography:** semantic font roles used by the app's interface and default writing presentation. Presets may define a coordinated font system; they do not need to use the same number of font families. The role set stays stable and must cover supported locales and scripts.
- **Shape:** semantic radius tokens such as `--radius-sm`, `--radius-md`, `--radius-lg`, and `--radius-xl`. Presets may change token values, not component-specific corner rules.

Do not add spacing/density changes to initial presets. They affect layout and need a separate product decision and wider review.

These current color tokens are derived from the semantic inputs and should not be duplicated in each preset without a demonstrated need:

- `--ink-hover`, `--ink-tint`, `--ink-tint-strong`
- `--hairline-strong`, `--raised-hover`
- `--sheet-shadow` (derived from `--sheet-tint`)
- `--muted-foreground` (alias of `--ink-muted`)

This inventory is the required preset contract. If shared UI adds a color, font, or shape token, decide whether it is a preset input, derived, or intentionally preset-independent, and update this document.

The `paper-ink` preset preserves current color, font, and shape values. A preset's writing typography is the default presentation for note content; it is separate from rich-text formatting controls. A future font-family control for selected text (Word-style `Aa`, allowing multiple fonts in one note) is a separate editor feature and is not part of, or a dependency for, Appearance presets. Note hues (`dialog-<hue>`, `prose-<hue>`, picker, shadow, and border utilities) remain per-note colors and are not appearance inputs.

### Phase 2 implementation snapshot

- **Preferences:** the browser-local Zustand store now persists `mode` (`system`, `light`, or `dark`) and `appearance` (`paper-ink` or `sepia`) under the existing storage key. Version 0 `theme: light|dark` values migrate to the same explicit mode; absent or invalid values fall back to `system` and `paper-ink`. Cross-tab storage events rehydrate the store.
- **First paint:** an inline bootstrap in the locale root layout reads the same key and applies the appearance and effective color mode before body content paints. Global error and global not-found documents use the same bootstrap helper. The hydrated theme wrapper updates the document root after store rehydration and follows OS color-scheme changes.
- **Typography:** both presets currently use Inter for UI and Newsreader for default writing presentation. The semantic roles are exposed through `--appearance-font-ui` and `--appearance-font-writing`.
- **Shape:** `paper-ink` uses 6/8/12/16px for `sm`/`md`/`lg`/`xl` radii. `sepia` uses 8/10/14/20px.
- **Sepia light inputs:** paper `oklch(0.965 0.022 82)`, raised paper `oklch(0.985 0.012 82)`, ink `oklch(0.245 0.03 55)`, muted ink `oklch(0.42 0.024 55)`, hairline `oklch(0.88 0.022 82)`, accent `oklch(0.49 0.13 62)`.
- **Sepia dark inputs:** paper `oklch(0.19 0.018 55)`, raised paper `oklch(0.235 0.022 55)`, ink `oklch(0.91 0.016 82)`, muted ink `oklch(0.68 0.022 70)`, hairline `oklch(0.32 0.02 55)`, accent `oklch(0.77 0.12 72)`.
- Sepia reuses the existing destructive and success inputs. Manually checked primary text pairs are: light ink/paper 14.74:1, muted ink/paper 7.69:1, accent/paper 5.86:1; dark ink/paper 14.16:1, muted ink/paper 6.41:1, accent/paper 8.77:1. Phase 4 still needs broader state and component coverage.

## Contrast and usability checks

For each preset and mode, verify:

- `--ink` on `--paper`: contrast ratio greater than 12:1, matching `DESIGN.md`.
- `--ink-muted` on `--paper`: at least 4.5:1.
- Text and controls on `--paper-raised`, including borders and focus indicators, remain distinguishable and usable.
- Accent, destructive, and success colors are tested in their actual foreground/background combinations. These colors may vary by preset, but must keep their meanings clear and meet applicable contrast requirements.
- Typography remains readable at supported sizes and locale/script combinations.
- Shape changes do not clip content, reduce control usability, or break component geometry.

Record tested color pairs and results with each preset review. The two numerical floors do not prove every UI state is usable.

## First preset set

- `paper-ink`: current default appearance, preserving today's values.
- `sepia`: warm paper, brown-black ink, amber-leaning accent, and a deliberately selected type/shape treatment.

Each preset is a complete, reviewed combination. Add presets deliberately; every one increases design, contrast, typography, and visual QA work in both modes.

## Appearance settings and preview

Add an Appearance section to the user settings page. Users select one complete preset; there are no separate font, shape, or color controls.

Include a compact representative preview in the first release. Each option should show enough examples of its surfaces, type, and shape to make the differences apparent, identify the current selection, and remain usable with keyboard and assistive technology. A full interactive preview can follow later; the initial preview need not reproduce the whole app.

## First-paint behavior

Apply the stored appearance and effective mode before the page is visibly painted, to avoid flashing the default preset or light mode. The pre-paint logic must use the same storage key, migration rules, and unknown-value fallback as the hydrated store.

Keep global error and global not-found documents consistent with the normal application document. Changes to `themeColor` metadata are deferred for the first release unless browser chrome mismatch proves materially confusing; if kept static, document that limitation.

## Compatibility rule

Shared UI must use semantic appearance tokens for colors, typography, and shape. Raw values are acceptable only when intentionally independent of the selected preset (for example, a specific per-note hue) and that exception is clear. Audit existing hard-coded styles as part of implementation rather than assuming the app is already fully tokenized.

## Out of scope

- User-mixed or individually adjustable appearance dimensions.
- Spacing/density and layout customization.
- Rich-text font-family formatting for selected text within a note.
- Seasonal/event decoration (for example, Christmas or Lunar New Year motifs).
- Account-level preference sync.
- Per-note hue redesign.
