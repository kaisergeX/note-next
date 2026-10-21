# Appearance Phase 4 review

> Archived validation evidence. Measurements and coverage limits describe the 2026-10-21 implementation; use [Appearance Presets](../theme-system.md) for current guidance.

Date: 2026-10-21. Presets: Paper & Ink and Sepia; modes: light and dark.

## Automated contrast evidence

Run `node --import tsx scripts/appearance-contrast.ts`. The script reads the actual CSS preset declarations, resolves derived Oklab mixtures, converts to linear sRGB (clipping out-of-gamut channels), and computes WCAG relative luminance. Browser canvas spot checks agree within 0.1 from 8-bit rounding/gamut conversion. Assertions use full precision; displayed ratios are rounded. The primary pair exceeds 12:1 in all combinations, normal semantic text passes 4.5:1, and control boundaries exceed 3:1.

| Foreground / background       | Minimum | Paper light | Paper dark | Sepia light | Sepia dark |
| ----------------------------- | ------: | ----------: | ---------: | ----------: | ---------: |
| ink / paper                   |    12:1 |     15.19:1 |    13.84:1 |     14.74:1 |    14.16:1 |
| paper / ink                   |    12:1 |     15.19:1 |    13.84:1 |     14.74:1 |    14.16:1 |
| ink / paper                   |   4.5:1 |     15.19:1 |    13.84:1 |     14.74:1 |    14.16:1 |
| ink / paper-raised            |   4.5:1 |     15.78:1 |    12.70:1 |     15.63:1 |    12.81:1 |
| ink-muted / paper             |   4.5:1 |      7.17:1 |     5.12:1 |      7.69:1 |     6.41:1 |
| ink-muted / paper-raised      |   4.5:1 |      7.45:1 |     4.70:1 |      8.16:1 |     5.79:1 |
| accent / paper                |   4.5:1 |      5.61:1 |     9.28:1 |      5.86:1 |     8.77:1 |
| accent / paper-raised         |   4.5:1 |      5.83:1 |     8.52:1 |      6.21:1 |     7.93:1 |
| destructive / paper           |   4.5:1 |      6.12:1 |     6.46:1 |      5.99:1 |     6.41:1 |
| destructive / paper-raised    |   4.5:1 |      6.35:1 |     5.93:1 |      6.35:1 |     5.80:1 |
| success / paper               |   4.5:1 |      6.31:1 |     7.93:1 |      6.18:1 |     7.87:1 |
| success / paper-raised        |   4.5:1 |      6.56:1 |     7.28:1 |      6.55:1 |     7.12:1 |
| warning / paper               |   4.5:1 |      6.72:1 |     9.15:1 |      6.58:1 |     9.08:1 |
| warning / paper-raised        |   4.5:1 |      6.98:1 |     8.40:1 |      6.98:1 |     8.21:1 |
| paper / ink-hover             |   4.5:1 |     11.37:1 |    10.48:1 |     11.05:1 |    10.72:1 |
| paper / destructive           |   4.5:1 |      6.12:1 |     6.46:1 |      5.99:1 |     6.41:1 |
| accent / raised-hover         |   4.5:1 |      4.88:1 |     7.29:1 |      5.21:1 |     6.74:1 |
| control-border / paper        |     3:1 |      3.46:1 |     4.05:1 |      3.37:1 |     4.18:1 |
| control-border / paper-raised |     3:1 |      3.60:1 |     3.72:1 |      3.57:1 |     3.78:1 |

Decorative `hairline` borders are deliberately below 3:1; they do not identify input boundaries or selected state. `control-border` identifies form controls and unselected appearance options. Focused inputs use a solid two-pixel accent/destructive ring; buttons and radios use a two-pixel accent outline. Disabled controls are exempt from text/non-text contrast requirements and retain disabled semantics. Status text names its state; success/errors use live regions where the underlying component provides them.

## Implementation corrections

- Replaced fixed amber draft badge styling with the semantic warning token. Replaced the homepage's fixed yellow toolbar highlight with accent tint/foreground.
- Corrected uncolored note/privacy prose to use semantic appearance roles rather than fixed Tailwind prose grays. Removed half-opacity note placeholders after the reviewer measured 3.85:1 in Sepia dark mode; explicit per-note hue palettes are retained.
- Added a derived control boundary token for shared Input, Appearance options, AI textareas/selects, and the chat composer. Kept decorative dividers quiet. Shared Input and native personality slider hit areas are at least 40px tall; focused controls use solid rings/outlines.
- Replaced the global error page's inert inline script with a client layout effect calling the shared preference helper before paint. A real root-layout fault showed that React does not execute that script during client fallback rendering; the static SSR preview alone could not catch it. Normal and standalone 404 documents serialize the same self-contained helper for pre-paint startup. The timing follows [React useLayoutEffect documentation](https://react.dev/reference/react/useLayoutEffect); Context7 tools were unavailable in this session.
- Corrected the persona editor's page title to h1 without changing its appearance.
- Moved global fallback files to the root `app/` directory so Next recognizes them. Both use semantic fonts and their own Inter font variable; standalone 404 uses a viewport-height document.
- Fixed first-paint storage divergence: server branding previously selected a different key from the hydrated browser store. `APPEARANCE_STORAGE_KEY` now preserves the actual existing client key `etoN-app` across store, normal bootstrap, global error, and global not-found. `node --import tsx scripts/appearance-bootstrap.ts` checks explicit modes against both OS preferences, system resolution, legacy choices, malformed/missing storage, unknown values, and denied storage access.

## Intentional exceptions

- Per-note hue colors/prose/pickers/shadows retain their independent palette. They are outside the preset color contract.
- Pill/circle geometry, square menu rows and chat-tail corners, and the large rounded chat composer (including its matching orbit path) stay fixed for their functional roles. Other shared sm/md/lg/xl radii follow the preset.
- Monospace code, logo/image inversion, and neutral transparent overlays are purpose-specific.
- Browser `themeColor` and iOS splash art remain static; account preference synchronization remains deferred.

## Typography and geometry

Built Inter and Newsreader font-face CSS includes the Vietnamese ranges (including U+0102–0103, U+0110–0111, U+01A0–01A1, U+01AF–01B0, and Vietnamese combining/extended characters). Selecting Latin preload subsets does not remove those font faces. UI uses the sans role and writing uses the serif role in both presets; generated CSS provides normal/italic Newsreader. Browser review includes actual English/Vietnamese settings, form text, and sample dialogue. The native slider keeps a 40px hit area with a centered native track.

## Browser review

Completed on 2026-10-21. The UI reviewer returned **PASS** in the targeted second review, with no remaining HIGH/MED findings in verified checks. The initial browser-profile lock was resolved by the owner before review resumed.

| Area                            | Coverage                                                                                                                                                          | Result                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Appearance settings             | EN/VI, both presets × light/dark at 1440/390px; 768px representative check                                                                                        | No overflow/text contrast failures; labels, keyboard radio selection, 2px focus indicators, and preview controls pass            |
| Landing pages                   | EN/VI, representative desktop/tablet/mobile and preset/mode combinations                                                                                          | Typography, note samples, and semantic highlight pass                                                                            |
| AI forms                        | EN/VI persona form in all four preset/mode combinations; bulk and new-run spot checks                                                                             | Controls and Vietnamese glyphs fit; h1 corrected; sliders measure 342×40px at 390px                                              |
| Notes                           | Empty editor dialog in all four combinations, desktop/mobile, theme picker and disabled texture control                                                           | Placeholder contrast now 15.77/12.69/15.61/12.83:1 (Paper light/dark, Sepia light/dark); no clipping                             |
| Shared controls/chat            | Actual Badge/Button/Input/ChatBubble/ChatInput/PersonaChatShell components in temporary local-state fixtures; four palette combinations, VI desktop/mobile drawer | Disabled states, status/error text, focus, local Send/Stop state, drawer Escape, geometry and contrast pass                      |
| Locale 404/privacy              | Actual locale 404 and representative privacy article                                                                                                              | Layout and semantic prose contrast pass                                                                                          |
| Standalone global 404           | Generated production markup in all four combinations, representative 1440/390px                                                                                   | Bootstrap, fonts, colors and geometry pass                                                                                       |
| Normal startup                  | All four explicit preset/mode choices against the opposite OS preference, unknown preset, and System under both OS modes                                          | Initial DOM and hydrated preference agree in all seven targeted browser cases                                                    |
| Real Next root-error fallback   | Temporary root-layout fault, Paper & Ink light/dark against opposite OS                                                                                           | Correct saved mode; custom error UI renders; inert-script warning gone                                                           |
| Global error component runtime  | Isolated client rendering of the actual final component, both presets × all three mode preferences × both OS modes (12 cases), plus unknown preset                | Preferences correct immediately after synchronous React commit/layout effects, without an inline bootstrap; reset callback fires |
| Global error responsive runtime | Actual final component with production CSS/Inter font output; all four palettes at 1440/390px                                                                     | No overflow; 40px button; body contrast 15.21/13.81/14.64/14.11:1 (8-bit browser canvas)                                         |

Control boundaries measured 3.59–3.79:1 against raised paper; warning badge text measured 7.00–8.37:1. Solid text/background composites were measured; dot-grid and image surfaces also received visual review.

The QA account and interview grant were available. No AI inference or database fixture creation was needed. Temporary app component routes and both root-layout test faults were removed, and isolated preview servers were stopped. Review tabs were closed while preserving the original tab and restoring the app review profile's Sepia/System preferences.

### Coverage limits

The app catchall routes unknown locale paths to the locale 404, so standalone global 404 **routing interception** was not exercised; its actual generated markup/bootstrap were reviewed. The final Sepia/System/unknown **Next root-fault integration** cases were not re-injected into the normal app after the owner questioned the global-file scope; the isolated actual-component runtime covers those appearance cases without interrupting the app. Its font-loader result was represented by the matching production Inter class and production styles; application component/preference logic was unchanged. Reset callback delivery was checked in isolation; recovery from a real underlying server failure, 404 navigation callbacks, AI inference, and AI persistence are outside this appearance review.

## Build and code checks

TypeScript and ESLint pass. Webpack production compilation and Serwist generation pass. Default Turbopack build still fails on the environment's process/port permission error, including when retried with elevated execution. Final TypeScript/ESLint and Webpack production build pass after removing component fixtures. The optimized inline scripts from the generated normal and global 404 HTML also passed 12 preset/mode/OS combinations each in an isolated VM, confirming their serialized helper is self-contained after minification.
