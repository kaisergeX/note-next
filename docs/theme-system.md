# Appearance Presets

**Status:** first-release foundation complete on 2026-10-21. This is the current feature contract; [DESIGN.md](../DESIGN.md) defines the app's visual rules. Completed work and validation evidence are archived below.

## User behavior

- Appearance lives at `/[locale]/settings/appearance`, alongside `/[locale]/settings/account`. The desktop user menu and mobile drawer link to Settings. `/[locale]/settings` opens Account; legacy `/[locale]/user` and `/[locale]/user#appearance` links redirect to the matching section. Users select a complete preset; color mode (`system`, `light`, or `dark`) is independent. Defaults are `paper-ink` and `system`.
- Available presets are **Paper & Ink**, **Sepia**, **Midnight**, and **Bookish**. Paper & Ink, Sepia, and Midnight use Inter for UI and Newsreader for writing. Midnight adds cool light paper and charcoal dark surfaces with a quiet blue accent. Bookish uses Source Sans 3 UI and Literata writing on sage/evergreen palettes. Radii are 6/8/12/16px except Sepia's 8/10/14/20px. Exact colors live in [app/globals.css](../app/globals.css).
- Preset and mode persist in this browser and synchronize across tabs. System mode follows OS changes in the normal app. Account/device synchronization is not implemented.
- Browser `theme-color` follows the effective paper background, including explicit mode overrides and Sepia. This is a suggested browser UI color; its visible effect depends on browser/platform support. iOS splash artwork remains static.
- Selection updates the app and shared preview immediately. The preview includes neutral note/prose, conversation, status, and controls. Its buttons demonstrate interaction states without performing actions; the sample input accepts local text. EN/VI labels, radio keyboard behavior, and selected/focus states are supported.
- Per-note hues remain independent. Appearance does not expose individual font/color/shape settings, change note formatting, or add spacing/density presets.

## Implementation invariants

### Preferences and startup

- [lib/appearance.ts](../lib/appearance.ts) owns preset IDs, mode validation, `APPEARANCE_STORAGE_KEY`, and the startup helper. [store/index.ts](../store/index.ts) persists only `mode` and `appearance`, using version 1 under the existing `etoN-app` key. Never derive this key from `SERVICE_NAME` or other server-only branding.
- Version 0 `theme: light|dark` choices migrate to the same explicit mode. Missing/invalid preferences normalize to System and Paper & Ink. Persist the preference, not an additional effective-mode value; resolve System from `prefers-color-scheme`.
- The [locale layout](../app/[locale]/layout.tsx) and [global 404](../app/global-not-found.tsx) apply stored preferences through an inline script before paint. [ThemeWrapper](../components/layouts/theme-wrapper.tsx) rehydrates, synchronizes tabs, and follows OS mode changes.
- [GlobalError](../app/global-error.tsx) uses a layout effect to apply preferences before its client fallback paints. React does not execute an inline script rendered by that client fallback. Global document fallbacks live directly under `app/` and supply their own styles/fonts; regular locale error/not-found pages remain under `[locale]`.
- `applyStoredAppearance` must stay self-contained: normal/404 bootstrap scripts serialize its function source, while GlobalError calls it directly. Do not introduce imports or closure dependencies into its body. Keep its ID allowlist aligned with `APPEARANCE_IDS` and store validation.
- `syncBrowserThemeColor` is also serialized in the startup script and must remain self-contained. It converts the effective CSS `--paper` token to sRGB metadata, with no separate preset palette. ThemeWrapper reapplies it on preference/OS changes and observes head metadata replacement during client navigation. GlobalError calls it directly after applying preferences.
- Runtime metadata uses `rgb(...)` while viewport fallbacks use hex. Keep their string representations distinct: React's hoisted-meta matching compares content without checking media/data attributes, so an identical string can let React adopt the runtime override and leave a duplicate fallback after navigation.
- [appearance-fonts.ts](../lib/appearance-fonts.ts) supplies shared font variables for the locale document and standalone global fallbacks. Bookish fonts include Vietnamese and use `preload: false` so their files load when selected rather than being preloaded for all presets. Font choices remain part of the preset, not per-note formatting.

### Tokens and rendering

Components consume semantic tokens through `@theme inline`; do not add component-specific preset branches. Unknown appearance IDs render Paper & Ink. Root selectors are `:root` for the default, `html[data-appearance='<id>']` for other presets, and `.dark`/`html.dark[data-appearance='<id>']` for effective dark mode. Keep matching `.appearance-preview` selectors consistent with the document palette.

| Dimension  | Preset inputs                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color      | `--paper`, `--paper-raised`, `--ink`, `--ink-muted`, `--hairline`, `--accent`, `--destructive`, `--success`, `--warning`, `--sheet-tint`, in both modes |
| Typography | `--appearance-font-ui`, `--appearance-font-writing`; support English and Vietnamese                                                                     |
| Shape      | `--appearance-radius-sm`, `--appearance-radius-md`, `--appearance-radius-lg`, `--appearance-radius-xl`                                                  |

Keep hover/tint, `hairline-strong`, `raised-hover`, sheet shadows, and `muted-foreground` derived or aliased centrally. `--control-border` mixes ink 50% with raised paper for distinguishable form boundaries; decorative hairlines remain subtle. Warning is a separate status role even when the preset's accent is amber.

Neutral prose uses `prose-appearance`; colored notes keep `prose-<hue>`. Editor placeholders retain full foreground contrast. Shared controls use the primitives in `components/ui/`, visible focus indicators, and at least 40px mobile targets.

Intentional exceptions are per-note hue palettes/swatches/shadows, monospace code, asset inversion, pill/circle shapes, square menu rows/chat-tail corners, and the large pill chat composer with its matching animation path. These do not become separate appearance controls.

## Adding or changing a preset

1. Update the ID registry, store validation as needed, and the self-contained startup helper's allowlist together.
2. Supply all token dimensions and light/dark values in `app/globals.css`, including matching preview selectors. Preserve derived values and per-note colors.
3. Add the option to [AppearanceSettings](../components/settings/appearance-settings.tsx) and its labels/descriptions in both dictionaries. Keep mode independent and use the shared preview.
4. Extend validation scripts for the new ID/palette, then review all preset/mode combinations across settings, notes/editor/dialogs, AI forms/chat, menus, status/disabled/focus states, and global fallbacks. Include English/Vietnamese, keyboard use, and representative desktop/mobile widths.
5. Record dated measurements and coverage limits. Keep this document current; append implementation history to the archive rather than restoring completed phase instructions here.

## Validation

```sh
node --import tsx scripts/appearance-bootstrap.ts
node --import tsx scripts/appearance-contrast.ts
pnpm lint
pnpm build
```

Bootstrap checks cover preferences, legacy migration, unknown/invalid values, storage failure, and agreement with the store key. Contrast checks read the shipped CSS: ink/paper must exceed 12:1, normal semantic text must meet 4.5:1, and form boundaries/focus indicators must meet applicable 3:1 requirements. Also check actual composited backgrounds, typography, geometry, and interactions in the browser; token ratios alone are insufficient.

The foundation review passed TypeScript/ESLint, Webpack production compilation, and Serwist generation; its Turbopack attempt hit an environment permission error. See the archived review for its evidence and limits.

**Settings follow-up — 2026-10-21:** lint, normal Turbopack production build, Serwist generation, bootstrap checks, and palette contrast checks pass. Browser review passed representative EN/VI Account and Appearance pages at 1440/768/390px, both presets and light/dark/System modes, keyboard focus, mobile drawer navigation, legacy redirects, reload persistence, and cross-tab/OS updates. Minimum measured text contrast was 4.53:1. After the metadata fix described above, repeated redirect/navigation/reload checks retained exactly one runtime color override and two OS fallbacks, with no hydration errors. Coverage was representative rather than every locale/preset/mode/width combination; native browser toolbar tinting was not device-tested.

**Midnight and Bookish — 2026-10-21:** lint, normal production build, and Serwist generation pass. Registry-driven bootstrap validation covers 37 preference cases plus store migration/merge checks for all four IDs. Contrast validation covers all eight preset/light-dark palettes; the two new presets provide at least 15.52:1 ink/paper, 5.22:1 across tested normal-text pairs, and 3.50:1 control boundaries. The generated global 404's minified startup script passes all 24 preset/mode/OS combinations, and its markup includes all four font variables. Browser review passed both new presets in light/dark at 1440/768/390px, representative Vietnamese settings, note editor/dialog, AI form and existing chat; minimum measured text contrast was 5.98:1. Actual Latin/Vietnamese font faces, restoration of the original presets' fonts, keyboard focus/selection, reload/cross-tab/System behavior, and three-tag browser-color metadata passed. Cold-cache first-paint font swapping, native mobile browser chrome, and exhaustive locale/theme coverage outside Settings were not verified; no data writes or AI generation were needed.

## Limits and deferred work

- Preferences remain browser-local. iOS splash artwork remains static. Actual browser toolbar tinting needs device verification; browser metadata values can be checked in desktop automation.
- The app catchall handles unmatched locale paths. Standalone global 404 markup/bootstrap were checked separately; routing interception was not verified. Real root-error integration was checked for Paper & Ink light/dark; the isolated actual component covered both presets, every mode/OS combination, unknown fallback, and reset callback delivery. These checks do not prove recovery from an underlying server failure.
- Deferred product work: account sync and a full interactive preview. Settings is accessible from the header user menu and mobile drawer. Density/spacing presets and optional seasonal decoration need separate scope decisions. Word-style font formatting for selected note text is a separate rich-text feature; per-note hue redesign is also outside this feature.

## Next-thread handoff

The foundation is complete. Continue from the current contract and validation commands above; use archives only for historical decisions or detailed evidence. These pending items are follow-ups, not unfinished foundation phases.

### Release checks — accepted

- [x] Release checks accepted by the project owner on 2026-10-21: owner reports checking the app, finding it works, and considers the checks passed. Device coverage is owner-reported rather than an independently recorded device matrix. The subsequent Settings follow-up also passes the normal Turbopack build and Serwist generation.

### Selected follow-ups — 2026-10-21

- [x] Move Appearance out of Profile into Settings, with separate Account and Appearance routes and responsive section navigation. Remove placeholder setting links; keep existing destructive actions disabled and explain their availability.
- [x] Match browser chrome metadata to the effective paper background. Keep iOS splash artwork unchanged.
- [x] Add Midnight and Bookish, including Bookish's distinct UI/writing font pair, while retaining independent light/dark/System mode and per-note hues.

### Optional product decisions — choose scope before implementation

- [ ] Decide whether preferences should follow a signed-in account across devices. If selected, define local/account precedence, first-login migration, and sign-out behavior before adding persistence changes.
- [ ] Revisit iOS splash artwork only if launch-screen appearance matching is needed; browser chrome metadata matching is included in the selected follow-ups above.
- [ ] Prioritize a richer interactive preview only if it solves a current user need. Current settings selection and compact preview are implemented.

When another preset is requested, follow the existing extension checklist rather than expanding customization controls. Keep completed checks and newly chosen scope current here; leave dated evidence in the archive. A useful opening prompt is: “Read `docs/theme-system.md`, review the pending release checks, and continue the Appearance follow-ups. The foundation is complete.”

## Archived evidence

- [Completed build plan and decisions](archive/theme-system-build-plan-history.md)
- [Phase 4 measurements, fixes, and coverage limits — 2026-10-21](archive/theme-system-phase4-review-2026-10-21.md)
