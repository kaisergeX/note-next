# Design Migration — Thread Status Log

Append one section per finished thread. Only record what the migration guide does NOT already say: owner decisions, deviations from scope, deferred issues, verification gaps. Never log per-file changes that fall inside a thread's listed scope.

Current state: after Thread 1 (App chrome), completed plus owner-confirmed add-ons. All changes are in the working tree (uncommitted at time of writing).

## Thread 1 — App chrome: DONE

### Owner decisions (binding)

- Out-of-chunk finds: inform owner first, act after confirmation (no strict chunk boundary).
- `classNames` (from '@kaiverse/k/utils') → `cn` (from 'cn', clsx + tailwind-merge) at every migrated spot. Caveat: `cn` does not resolve postfix-important (`fixed!`) against plain (`relative`) — keeps both; `!important` still wins in CSS, so safe either way. `components/ui/button.tsx` internal join deliberately stays `classNames`.
- Global-error/global-not-found: inline before-paint dark script only (reads zustand localStorage key `process.env.SERVICE_NAME ?? 'etoN-app'`, `{state:{theme}}`, OS fallback). Live theme switching NOT wanted (initial render only).
- Homepage/landing (`app/[locale]/page.tsx`): owner will design + implement later as a separate task, NOT in a migration thread. Current Lorem ipsum is placeholder — ignore.
- Add-ons owner approved beyond the listed scope: `components/ui/menu.tsx` internals tokenized; `components/ui/button.tsx` exports `buttonClass()`; new `components/ui/link-button.tsx`; `signin-button.tsx` + `go-back-button.tsx` internals → `<Button>`; icon buttons 40px (`rounded-full` baked into Button iconOnly).
- Desktop sign-out menu row `p-3` to match menu items: fine.

### Deferred / known issues

- Thread 3: full note page `/en/eton/[id]` — mismatched background strips (toolbar/title vs page vs note-hue editor surface). Likely exposed by Thread 1's body bg change (`bg-default` zinc → `bg-paper` warm). Investigate + fix there.
- Thread 7 cleanup (globals.css): remaining legacy utilities + `body:has(main.bg-fancy)` cascade + `:root:has(body > main.bg-fancy)` scrollbar rules + dead `font-inter` classes (theme-wrapper, global-error). Already removed in Thread 1: `text-gradient`, `ring-theme`, `ring-reverse`, `header.glass` nested override. Then run the repo-wide legacy grep per migration guide step 2.
- Thread 3 files (note-editor, note-customize) still use legacy `glass`, `bg-default`, `shadow-theme`, `button*`, `text-danger`; Thread 2: `note-create.tsx` uses `max-sm:button-affix` (last consumer), `note-tiny.tsx` has legacy `button-secondary`/`text-danger`.
- Thread 4/5 files (persona-roster-card, session-row) style their own MenuCustom items with `hover:bg-reverse … p-4` — tokenize during those threads.
- Avatar MenuCustom dropdown never visually tested (needs auth session).
- themeColor is prefers-color-scheme (static), not the manual toggle — pre-existing.

### globals.css notes (all threads)

- `--font-sans` now maps Inter (was never wired before Thread 1).
- Radius scale now matches DESIGN.md Shapes: `--radius-sm/md/lg/xl = 6/8/12/16px`.
- New `animate-header-shadow` utility + `header-sheet-shadow` keyframes (reduced-motion gated).

### Verification

- `pnpm lint` + `pnpm build` pass (76 static pages, service worker 139 URLs). Visual QA passed: header/login/404/denied in both modes, desktop + mobile. Not visually tested: authenticated header (avatar dropdown), note routes (Threads 2/3).

## Future (outside migration)

- Full-palette theme switching: design spec at docs/theme-system.md — deferred, additive, no current docs/CSS changes needed.
