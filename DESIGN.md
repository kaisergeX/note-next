---
version: alpha
name: Design System
description: Shared interface principles, appearance contracts, and component guidance.
omitted:
  - section: colors
    reason: Runtime values are maintained in app/globals.css.
  - section: typography
    reason: Font loading and role mappings are maintained in lib/appearance-fonts.ts and app/globals.css.
  - section: spacing
    reason: Shared spacing utilities and component layouts supply implementation values.
  - section: rounded
    reason: Preset radius values are maintained in app/globals.css.
  - section: components
    reason: Shared primitives supply component styles and states.
---

# Design System

Format: [DESIGN.md specification](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md).

## Overview

This document defines the design contract for the whole application: notes, AI features, settings, and future features.
Prioritize readable content, clear task hierarchy, predictable interaction, and continuity across appearances.
Appearance presets express different visual identities; no single preset defines the application's universal aesthetic.

This contract governs implementation. Linked code supplies executable values and APIs, not proof of compliance.
Treat conflicts as implementation gaps; do not weaken a requirement or invent an exception to match existing code.
Token values are intentionally maintained in code rather than duplicated in this document.

- [Global styles](app/globals.css): semantic tokens, preset mappings, typography, shape, elevation, and motion.
- [Appearance definitions](lib/appearance.ts): preset identity and color mode; [font definitions](lib/appearance-fonts.ts): font loading.
- [Shared primitives](components/ui/): reusable controls; [appearance preview](components/settings/appearance-preview.tsx): representative states.

## Colors

Choose colors by semantic purpose. A preset may change their values while preserving their meaning.
The existing `paper` and `ink` names identify surface and foreground roles across all appearances.

| Role | Usage |
| --- | --- |
| `paper`, `paper-raised` | Application canvas and contained surfaces. Keep adjacent surfaces distinguishable. |
| `ink`, `ink-muted` | Main content and supporting text. Muted text must remain readable. |
| `accent` | Interactive emphasis, links, selection, and focus. Its hue belongs to the preset. |
| `destructive`, `warning`, `success` | Destructive actions and semantic status; meaning must remain consistent across presets. |
| `control-border`, `hairline` | Identifiable control boundaries and quieter structural dividers, respectively. |

- Primary actions must be distinguishable from supporting actions; consume the shared button variant rather than assigning a page-specific fill.
- Hover, active, selected, invalid, and disabled treatments must remain distinguishable in both color modes.
- Links within prose need a recognizable treatment beyond color alone. Status also needs text or an equivalent non-color cue.
- Per-note colors are a separate content choice. Preserve their surface, prose, swatch, border, and shadow roles from
  [note theme definitions](config/tailwindTheme.ts); do not spread note hues into unrelated application chrome.

## Typography

- Define a UI family and a writing family per preset; preserve these roles when changing families.
- UI text covers navigation, controls, labels, metadata, forms, and chat. Writing text covers note titles, prose, and previews.
- Consume `font-sans` and the writing alias `font-serif`; use `prose-appearance` for neutral writing and `prose-<hue>` for colored notes.
  Code remains monospace. Font choices belong to the preset, not individual components.
- Establish hierarchy through a small, consistent type scale and weight system. Avoid competing display styles and long uppercase labels.
- Preserve user-authored emphasis. Provide comfortable line spacing and readable line lengths without imposing one width on every feature.
- Support English and Vietnamese, text resizing, fallback fonts, and wrapping. Do not truncate essential content or action labels.
- Load optional preset fonts on demand; changing appearance must preserve content, editing state, and control usability.
- The header wordmark and its appearance preview follow the preset's writing font, with the shared `text-wordmark` scale and ink color. Presets may adjust the wordmark's optical alignment through `--appearance-wordmark-offset-y`.

## Layout

- Organize each view around its task: primary content first, related controls nearby, secondary information subordinate.
- Use shared spacing utilities consistently; tighter spacing groups related items, larger gaps separate sections.
- Let content and available space determine breakpoints. Adapt navigation and toolbars without removing essential actions.
- Reflow at narrow widths and zoom without page-wide horizontal scrolling; genuinely two-dimensional content may scroll within its own region.
- Keep reading, editing, and conversation measures appropriate to their task. Do not force cards, forms, and editors into one container width.
- Sticky headers, toolbars, and composers must respect safe areas and leave focused controls and relevant content visible.
- Preserve logical reading and tab order in grids and masonry layouts. Visual placement must not change interaction order.
- Empty states explain the situation and offer a relevant next action. Loading states reserve useful space and avoid disruptive layout shifts.

## Elevation & Depth

- Use surface contrast, spacing, and borders to establish grouping before adding shadows.
- Elevation communicates overlap or attachment: popovers, dialogs, sticky controls, and focused interaction surfaces.
- Use shared elevation tokens such as `shadow-sheet`; tune their appearance centrally rather than stacking local shadows.
- Resting content cards and buttons should not compete with overlays for prominence.
- Note surfaces may retain hue-tinted shadows. Modal backdrops must distinguish the active layer while preserving context.

## Shapes

- Use semantic radius roles consistently: small details, controls, containers, and larger surfaces.
- Presets may change the radius scale. Individual pages must not invent a competing scale.
- Preserve functional geometry: circular swatches, pill badges, menu rows, chat tails, and composer contours.
- Icon buttons must remain recognizable controls; visual shape must not reduce the hit area.
- Full-screen mobile dialogs may use square outer corners; inset dialogs use the shared container shape.

## Components

Reuse a primitive before adding a variant, and add a shared variant before duplicating a component.
Component behavior and semantic roles stay consistent across presets; appearance comes from shared tokens.

| Need | Selection and requirements |
| --- | --- |
| Actions | [Button](components/ui/button.tsx): primary for the task's main action, secondary for supporting actions, ghost for low-emphasis controls, danger for destructive actions, link for text-like presentation. Use real links for navigation. |
| Destructive actions | Name the outcome explicitly. Match confirmation or recovery to the action's consequences; do not style ordinary actions as dangerous. |
| Form fields | [Input](components/ui/input.tsx): persistent associated labels, nearby help/error text, and invalid state. Placeholders supplement labels. |
| Note editing | [Editor](components/note/note-editor.tsx) and [formatting toolbar](components/ui/rte-commands.tsx): preserve authored content, selection, and editing state. Toolbar controls use UI typography. |
| Disclosures | [MenuCustom](components/ui/menu.tsx) for action/link lists; [PopoverBase](components/ui/popover.tsx) for custom non-modal content. Preserve native links/buttons and normal tab order. |
| Dialogs | Use `Dialog` from `@kaiverse/k/ui`, as in [note dialogs](components/note/note-dialog.tsx). Confirmations use [ConfirmationDialog](components/ui/confirmation-dialog.tsx), which adds focus restoration and pending-action dismissal protection to that library component. Inspect these before adding another implementation; preserve library motion and reduced-motion support. Use a modal only when the task requires interruption; provide a name, dismissal, focus containment, and focus restoration. |
| Status | [Badge](components/ui/badge.tsx) for compact labels. Use text with semantic status styling; badges do not replace error explanations or recovery actions. |
| Conversation | Reuse [chat bubbles](components/ai/interview/chat-bubble.tsx) and [composer](components/ai/interview/chat-input.tsx). Distinguish participants, preserve readable messages, and expose Send/Stop state clearly. |

- Define default, hover, focus, active/selected, disabled, loading, error, and success states where relevant.
- Pending actions announce progress and prevent duplicate submission without discarding user input.
- Explain failures near their cause and offer recovery. Preserve entered content when an operation fails.
- Dialog replacement sequences use the shared [DialogFlow](components/ui/dialog-flow.tsx) under a persistent scoped provider. Keep one native dialog and backdrop open across screen preparation; focus the new screen and restore the caller when returning. Place the provider above loading branches and outside route view-transition snapshots. Independent confirmations may still use `ConfirmationDialog` as a separate modal. See [dialog-flow usage](docs/dialog-flows.md).

## Do's and Don'ts

- Do resolve presentation through semantic tokens and shared components; keep token values in their implementation sources.
- Do extend a shared role explicitly when a real need is uncovered. Do not use one-off values or preset-name branches in feature components.
- Do keep visual emphasis proportional to importance. Do not confuse a preset's personality with a different interaction model.
- Do report implementation gaps separately. Do not describe an accessibility failure as an intentional aesthetic exception.
- Do use the CSS-first styling setup in [global styles](app/globals.css); do not introduce a parallel theme configuration.

## Accessibility

The baseline is [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/) across all presets and modes.

- Use semantic HTML, accessible names, associated labels, meaningful headings, and logical keyboard navigation.
- Every interactive element needs a visible focus indicator that is not hidden by sticky or overlapping content.
  Note-writing surfaces may use a clearly visible caret without an added outline; toolbar controls and ordinary fields retain explicit focus treatment.
- Normal text needs at least 4.5:1 contrast; WCAG-defined large text needs 3:1. Essential control boundaries and state indicators need applicable 3:1 contrast.
  Evaluate actual rendered backgrounds, including note hues, transparency, and interaction states.
- Standalone mobile controls need at least 40px hit areas. Expanded hit areas must not overlap adjacent targets.
  Inline links follow WCAG target-size exceptions rather than forcing oversized text lines.
- Use disclosure semantics for ordinary link/action lists. Arrow/Home/End/typeahead may supplement Tab navigation; do not add ARIA menu roles without the full menu interaction pattern.
- Tabs and comboboxes follow their respective [ARIA patterns](https://www.w3.org/WAI/ARIA/apg/patterns/), including state, focus management, and keyboard operation.
- Announce errors and asynchronous status appropriately (`role="alert"` or `role="status"`); avoid repetitive announcements.
- Preserve usability with text enlargement, browser zoom, forced colors, and keyboard-only input. Never make hover the only way to reveal an action.

## Motion

- Animate to explain a transition, acknowledge input, or communicate progress; keep content and controls stable.
- Share motion definitions and timing. Do not give each component its own motion language or add motion solely to express a preset.
- Honor `prefers-reduced-motion`: remove nonessential movement, scroll-driven effects, and looping animation; retain a static indication of progress or state.
- Do not rely on animation alone to convey information, delay access to controls, or introduce flashing effects.

## Appearance presets

- An appearance is one complete selectable preset. Seasonal styles use the same contract; there is no separate decoration system.
- Presets may vary palette, UI/writing fonts, radius scale, and elevation treatment while preserving semantics, content hierarchy, and component behavior.
- Color mode remains independent (`system`, `light`, `dark`). Every preset supplies both light and dark presentations.
- The [preset registry](lib/appearance.ts) defines available choices. Paper & Ink is the default preset, not a restriction on other presets' visual identity.
- Keep per-note hue choices independent. Changing appearance must not rewrite notes, reset forms, lose focus, or clear preview examples.
- Keep root and [preview](components/settings/appearance-preview.tsx) token mappings equivalent. Browser chrome follows the effective canvas color; iOS splash artwork remains static.

### Adding or changing a preset

1. Define its visual intent and complete semantic palette, font roles, shapes, elevation, and interaction-state treatment.
2. Reuse the shared contract; implement values centrally. Keep registry/startup validation, [stored preferences](db/schema/user-appearance.ts), font loading, and localized labels aligned.
3. Verify light/dark modes, English/Vietnamese, keyboard/focus behavior, contrast, reduced motion, narrow layouts, and representative component states.
   Use [contrast checks](scripts/appearance-contrast.ts) as supporting evidence; token ratios alone do not establish accessibility.
4. Record genuine new design decisions here. Keep preset values in code and implementation defects outside this guideline.
