# Appearance Presets

**Status:** complete as of 2026-10-21: four presets, Settings navigation, browser color matching, and an interactive preview. This is the current feature contract; [DESIGN.md](../DESIGN.md) defines the visual rules. Earlier planning and audit records are linked below.

## User behavior

- Appearance lives at `/[locale]/settings/appearance`, alongside `/[locale]/settings/account`. The desktop user menu and mobile drawer link to Settings. `/[locale]/settings` opens Account; legacy `/[locale]/user` and `/[locale]/user#appearance` links redirect to the matching section. Users select a complete preset; color mode (`system`, `light`, or `dark`) is independent. Defaults are `paper-ink` and `system`.
- Available presets are **Paper & Ink**, **Sepia**, **Midnight**, and **Bookish**. Paper & Ink, Sepia, and Midnight use Inter for UI and Newsreader for writing. Midnight adds cool light paper and charcoal dark surfaces with a quiet blue accent. Bookish uses Source Sans 3 UI and Literata writing on sage/evergreen palettes. Radii are 6/8/12/16px except Sepia's 8/10/14/20px. Exact colors live in [app/globals.css](../app/globals.css).
- Preset and mode persist in this browser and synchronize across tabs. System mode follows OS changes in the normal app. Account/device synchronization is not implemented.
- Browser `theme-color` follows the effective paper background, including explicit mode overrides and Sepia. This is a suggested browser UI color; its visible effect depends on browser/platform support. iOS splash artwork remains static.
- Selection updates the app and shared preview immediately. The preview has Form, Conversation, and Controls tabs: edit a sample title/body, toggle whole-body bold/italic/highlight, send a local message with a simulated reply/Stop state, and try validation/loading/success/disabled controls and status badges. Preview edits are temporary and remain while comparing presets, modes, or tabs; Reset clears all examples without changing appearance preferences. EN/VI labels and keyboard tab/radio navigation are supported.
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
- [AppearancePreview](../components/settings/appearance-preview.tsx) owns only local demo state. It does not save notes, persist demo text, or call AI endpoints. Tabs retain their examples; Reset remounts the examples and cleans up pending reply/save timers. The chat keeps two seed messages and at most four recent demo messages. FormPreview shows standard title/body fields with whole-body sample formatting; it does not represent the rich-text editor used in real notes.

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
3. Add labels/descriptions in both dictionaries; [AppearanceSettings](../components/settings/appearance-settings.tsx) lists registry IDs automatically. Register any new fonts in `lib/appearance-fonts.ts` and assign their CSS roles. Keep mode independent and use the shared preview.
4. Extend validation scripts for the new ID/palette, then review all preset/mode combinations across settings, notes/editor/dialogs, AI forms/chat, menus, status/disabled/focus states, and global fallbacks. Include English/Vietnamese, keyboard use, and representative desktop/mobile widths.
5. Update the concise validation summary and coverage limits here. Use the existing archives for historical context; routine follow-ups do not need separate reports or completed-phase checklists.

## Validation

```sh
node --import tsx scripts/appearance-bootstrap.ts
node --import tsx scripts/appearance-contrast.ts
pnpm lint
pnpm build
```

Bootstrap checks cover preferences, legacy migration, unknown/invalid values, storage failure, and agreement with the store key. Contrast checks read the shipped CSS: ink/paper must exceed 12:1, normal semantic text must meet 4.5:1, and form boundaries/focus indicators must meet applicable 3:1 requirements. Also check actual composited backgrounds, typography, geometry, and interactions in the browser; token ratios alone are insufficient.

Latest validation — **2026-10-21**:

| Area                | Evidence                                                                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build               | TypeScript/ESLint, normal Turbopack production build, and Serwist generation pass. The earlier environment-specific Turbopack failure is historical.                                                                                                                                  |
| Preferences/startup | 37 preference cases plus migration/merge checks for all four IDs pass. The generated global 404 bootstrap passes 24 preset/mode/OS combinations; its markup includes all four font variables.                                                                                         |
| Palettes/layout     | All eight preset/light-dark palettes pass required token ratios. Representative EN/VI browser reviews at 1440/768/390px cover settings, notes/dialogs, and AI forms/chat; minimum measured text contrast is 4.53:1. Actual Latin/Vietnamese font faces, focus, and 40px targets pass. |
| Appearance behavior | Reload/cross-tab persistence, System following OS changes, explicit overrides, font restoration, localized navigation, and legacy redirects pass. Browser metadata retains one runtime override and two OS fallbacks without hydration errors.                                        |
| Interactive preview | Keyboard tabs, formatting/edit preservation, validation/loading/success, disabled controls, long-message wrapping, reduced motion, Stop, and Reset during pending timers pass. Demo interactions made no API requests.                                                                |

The owner accepted the initial release/device checks on this date; that acceptance is not an independently recorded device matrix. Browser coverage above is representative, not every locale/preset/mode/tab/route combination.

## Remaining checks and scope limits

- [ ] Check Bookish's first-paint font swapping with a cold cache or slow connection.
- [ ] Check native browser toolbar colors on real Android/iOS devices.
- [ ] Verify preview announcements with screen-reader software.

Global fallback coverage is limited: standalone 404 markup/bootstrap were checked; the catchall handles normal unmatched locale paths, and standalone 404 routing interception was not verified. Real root-error integration covered Paper & Ink light/dark; isolated component checks covered the original Paper & Ink/Sepia presets, all mode/OS combinations, unknown fallback, and reset callback delivery. The newer presets' root-error integration and recovery from a real server failure remain unverified.

Preferences remain browser-local and iOS splash artwork remains static. Account sync is optional future work; define local/account precedence, first-login migration, and sign-out behavior before implementing it. Dynamic splash artwork also needs separate platform/device scope. Individual font/color editors, selected-text rich-text formatting, density, seasonal decoration, and per-note hue redesign are separate features.

## Archived evidence

- [Completed build plan and decisions](archive/theme-system-build-plan-history.md)
- [Phase 4 measurements, fixes, and coverage limits — 2026-10-21](archive/theme-system-phase4-review-2026-10-21.md)
