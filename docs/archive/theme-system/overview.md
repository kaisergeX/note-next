# Appearance Presets

> Archived on 2026-10-22 after implementation was completed and accepted. This document preserves the completed feature contract and validation record. [DESIGN.md](../../../DESIGN.md) remains the active design reference.

**Status:** implementation complete and accepted by the owner on 2026-10-22. Four presets, Settings navigation, account synchronization, browser color matching, and the interactive preview are complete. No implementation work remains in this scope. This is the current feature contract; [DESIGN.md](../../../DESIGN.md) defines the visual rules. Planning and audit history are archived below.

## User behavior

- Appearance lives at `/[locale]/settings/appearance`, alongside `/[locale]/settings/account`. Guests can open Appearance from the header palette link; the desktop user menu and mobile drawer link to Settings. Account remains sign-in-only, and guests do not see its navigation item. `/[locale]/settings` opens Appearance; legacy `/[locale]/user` and `/[locale]/user#appearance` links redirect to the matching section. Users select a complete preset; color mode (`system`, `light`, or `dark`) is independent. Defaults are `paper-ink` and `system`.
- Available presets are **Paper & Ink**, **Sepia**, **Midnight**, and **Bookish**. Paper & Ink, Sepia, and Midnight use Inter for UI and Newsreader for writing. Midnight adds cool light paper and charcoal dark surfaces with a quiet blue accent. Bookish uses Source Sans 3 UI and Literata writing on sage/evergreen palettes. Radii are 6/8/12/16px except Sepia's 8/10/14/20px. Exact colors live in [app/globals.css](../../../app/globals.css).
- Guests persist preset and mode in this browser. Signed-in users synchronize both with their account. An existing account preference wins on sign-in; if none exists, the current browser choice initializes it atomically without overwriting another device. System mode follows each device’s OS setting. Sign-out retains the current appearance locally.
- Browser `theme-color` follows the effective paper background, including explicit mode overrides and Sepia. This is a suggested browser UI color; its visible effect depends on browser/platform support. iOS splash artwork remains static.
- Selection updates the app and shared preview immediately. The preview has Form, Conversation, and Controls tabs: edit a sample title/body, toggle whole-body bold/italic/highlight, send a local message with a simulated reply/Stop state, and try validation/loading/success/disabled controls and status badges. Preview edits are temporary and remain while comparing presets, modes, or tabs; Reset clears all examples without changing appearance preferences. EN/VI labels and keyboard tab/radio navigation are supported.
- Per-note hues remain independent. Appearance does not expose individual font/color/shape settings, change note formatting, or add spacing/density presets.

## Implementation invariants

### Preferences and startup

- [lib/appearance.ts](../../../lib/appearance.ts) owns preset IDs, mode validation, `APPEARANCE_STORAGE_KEY`, and the startup helper. [store/index.ts](../../../store/index.ts) persists only `mode` and `appearance`, using version 1 under the existing `etoN-app` key. Never derive this key from `SERVICE_NAME` or other server-only branding.
- Version 0 `theme: light|dark` choices migrate to the same explicit mode. Missing/invalid preferences normalize to System and Paper & Ink. Persist the preference, not an additional effective-mode value; resolve System from `prefers-color-scheme`.
- The [locale layout](../../../app/[locale]/layout.tsx) and [global 404](../../../app/global-not-found.tsx) apply stored preferences through an inline script before paint. [ThemeWrapper](../../../components/layouts/theme-wrapper.tsx) rehydrates, synchronizes tabs, and follows OS mode changes.
- [GlobalError](../../../app/global-error.tsx) uses a layout effect to apply preferences before its client fallback paints. React does not execute an inline script rendered by that client fallback. Global document fallbacks live directly under `app/` and supply their own styles/fonts; regular locale error/not-found pages remain under `[locale]`.
- `applyStoredAppearance` must stay self-contained: normal/404 bootstrap scripts serialize its function source, while GlobalError calls it directly. Do not introduce imports or closure dependencies into its body. Keep its ID allowlist aligned with `APPEARANCE_IDS` and store validation.
- `syncBrowserThemeColor` is also serialized in the startup script and must remain self-contained. It converts the effective CSS `--paper` token to sRGB metadata, with no separate preset palette. ThemeWrapper reapplies it on preference/OS changes and observes head metadata replacement during client navigation. GlobalError calls it directly after applying preferences.
- Runtime metadata uses `rgb(...)` while viewport fallbacks use hex. Keep their string representations distinct: React's hoisted-meta matching compares content without checking media/data attributes, so an identical string can let React adopt the runtime override and leave a duplicate fallback after navigation.
- [appearance-fonts.ts](../../../lib/appearance-fonts.ts) supplies shared font variables for the locale document and standalone global fallbacks. Bookish fonts include Vietnamese and use `preload: false` so their files load when selected rather than being preloaded for all presets. Font choices remain part of the preset, not per-note formatting.
- [AppearancePreview](../../../components/settings/appearance-preview.tsx) owns only local demo state. It does not save notes, persist demo text, or call AI endpoints. Tabs retain their examples; Reset remounts the examples and cleans up pending reply/save timers. The chat keeps two seed messages and at most four recent demo messages. FormPreview shows standard title/body fields with whole-body sample formatting; it does not represent the rich-text editor used in real notes.

### Account synchronization

- `user_appearance` stores one preset/mode pair per user, with a cascading foreign key and database checks. Apply the generated migration before deploying this feature.
- `/api/user/appearance` authenticates every read/write, validates account identity and preference values, rejects cross-origin writes, and returns private/no-store responses. The service worker uses NetworkOnly for this endpoint.
- `AppearanceSync` runs inside SessionProvider, after browser-store hydration. It immediately uses a per-account local cache and then reconciles with the server. Pending edits survive reloads in `etoN-appearance-account:<email>` and never transfer to another account. Local preference actions increment a transient change counter; storage rehydration and remote updates do not create write loops.
- Local changes apply immediately. Writes are serialized and a late response cannot clear newer pending edits. Failed/offline writes retry on reconnect, focus, visibility, or the visible-page 60-second interval. Fresh remote reads never replace pending local edits. Once reconnected, the last accepted explicit save wins; concurrent edits are not merged.
- Other devices refresh on focus and while visible every 60 seconds. This is periodic synchronization, not a realtime subscription. Guest edits make no account API calls. Local caching is best-effort if browser storage is disabled; in that case pending edits cannot survive a reload.
- Appearance shows localized device/account/offline/retry status. Requests are aborted on confirmed account changes and verify the expected account on both sides. `useAppearanceAccount` keeps the last confirmed identity when an offline/failed Auth.js session refresh returns no client session. A direct, uncached successful session check distinguishes a real sign-out (JSON null/empty session) from a transport failure. The tab remembers its last account in sessionStorage for recovery; this is only a queue owner hint, and every upload is still authenticated and checked by the API. Reconnection also recovers the shared client session UI.

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

### Verification

- `node --import tsx --test scripts/appearance-sync.test.ts` checks precedence, initialization, offline retry, in-flight edits, stale cross-tab responses, and session isolation.
- `APPEARANCE_TEST_ORIGIN=http://localhost:3000 node --import tsx --test scripts/appearance-api.test.ts` checks the running development app's public/protected routes and API boundaries using the existing QA account. Apply migrations and provision that account first; keep its preferences idle while the integration check runs.
- `scripts/appearance-offline.browser.mjs` exports `verifyAppearanceOffline(browser, baseURL)` for an existing Playwright Browser against localhost. It verifies Sepia → offline → failed session refresh → Midnight → reconnect, the saved server preference, a separate browser context, reload, transport failure with navigator still online, and confirmed sign-out. It creates isolated contexts and restores the original QA preference. This covers the real auth lifecycle that the queue unit tests cannot simulate.
- `node --import tsx scripts/appearance-bootstrap.ts` checks startup, invalid values, and legacy preference migration. Browser QA must also verify guest and signed-in choices survive a full reload; sync effects must never write to the persisted store before hydration finishes.

## Adding or changing a preset

1. Update the ID registry, store validation as needed, and the self-contained startup helper's allowlist together.
2. Supply all token dimensions and light/dark values in `app/globals.css`, including matching preview selectors. Preserve derived values and per-note colors.
3. Add labels/descriptions in both dictionaries; [AppearanceSettings](../../../components/settings/appearance-settings.tsx) lists registry IDs automatically. Register any new fonts in `lib/appearance-fonts.ts` and assign their CSS roles. Extend the `user_appearance` preset check with a migration for new IDs. Keep mode independent and use the shared preview.
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

Recorded build/browser validation — **2026-10-21** (not rerun for the documentation closeout):

| Area                | Evidence                                                                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build               | TypeScript/ESLint, normal Turbopack production build, and Serwist generation pass. The earlier environment-specific Turbopack failure is historical.                                                                                                                                  |
| Preferences/startup | 37 preference cases plus migration/merge checks for all four IDs pass. The generated global 404 bootstrap passes 24 preset/mode/OS combinations; its markup includes all four font variables.                                                                                         |
| Palettes/layout     | All eight preset/light-dark palettes pass required token ratios. Representative EN/VI browser reviews at 1440/768/390px cover settings, notes/dialogs, and AI forms/chat; minimum measured text contrast is 4.53:1. Actual Latin/Vietnamese font faces, focus, and 40px targets pass. |
| Appearance behavior | Reload/cross-tab persistence, System following OS changes, explicit overrides, font restoration, localized navigation, and legacy redirects pass. Browser metadata retains one runtime override and two OS fallbacks without hydration errors.                                        |
| Interactive preview | Keyboard tabs, formatting/edit preservation, validation/loading/success, disabled controls, long-message wrapping, reduced motion, Stop, and Reset during pending timers pass. Demo interactions made no API requests.                                                                |

Owner device acceptance — **2026-10-22**: on iOS, native browser toolbar colors updated with the selected preset. Bookish showed font swapping and some layout movement on a slow connection; the owner accepted this behavior with the current on-demand font loading. Font-loading optimization is optional future work. This is owner-reported evidence, not an independently recorded device matrix.

## Accepted coverage and scope limits

The owner closed this feature without requesting further validation. These coverage limits are retained for reference, not as an outstanding release checklist:

- Browser coverage is representative, not every locale/preset/mode/tab/route combination. Real Android toolbar colors and screen-reader preview announcements were not verified.
- Global fallbacks: standalone 404 markup/bootstrap were checked, but routing interception was not verified (normal unmatched locale paths use the catchall). Real root-error integration covered Paper & Ink light/dark; isolated checks covered Paper & Ink/Sepia across modes/OS preferences, unknown fallback, and reset callback delivery. Midnight/Bookish root-error integration and recovery from a real server failure were not verified.

iOS splash artwork remains static. Dynamic splash artwork, individual font/color editors, selected-text rich-text formatting, density, seasonal decoration, and per-note hue redesign are separate features.

## Archived evidence

- [Completed build plan and decisions](build-history.md)
- [Phase 4 measurements, fixes, and coverage limits — 2026-10-21](validation.md)
