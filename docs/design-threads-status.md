# Design Migration — Thread Status Log

Append one section per finished thread. Only record what the migration guide does NOT already say: owner decisions, deviations from scope, deferred issues, verification gaps. Never log per-file changes that fall inside a thread's listed scope.

Current state: after Thread 2 (Notes list), completed plus owner-approved defaults. All changes are in the working tree (uncommitted at time of writing).

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
- Thread 7 cleanup (globals.css): remaining legacy utilities + `body:has(main.bg-fancy)` cascade + `:root:has(body > main.bg-fancy)` scrollbar rules + dead `font-inter` classes (theme-wrapper, global-error). Already removed in Thread 1: `text-gradient`, `ring-theme`, `ring-reverse`, `header.glass` nested override. Then run the repo-wide legacy grep per migration guide step 2. Note: `privacy/page.tsx` and `admin/layout.tsx` still set `bg-fancy` — the `body:has` + scrollbar cascade must be removed in Thread 7 only after those are migrated (Thread 2 kept them to avoid regressing untouched routes).
- Thread 3 files (note-editor, note-customize) still use legacy `glass`, `bg-default`, `shadow-theme`, `button*`, `text-danger`; Thread 2 done — those are migrated.
- Thread 4/5 files (persona-roster-card, session-row) style their own MenuCustom items with `hover:bg-reverse … p-4` — tokenize during those threads.
- Avatar MenuCustom dropdown never visually tested (needs auth session).
- themeColor is prefers-color-scheme (static), not the manual toggle — pre-existing.

### globals.css notes (all threads)

- `--font-sans` now maps Inter (was never wired before Thread 1).
- Radius scale now matches DESIGN.md Shapes: `--radius-sm/md/lg/xl = 6/8/12/16px`.
- New `animate-header-shadow` utility + `header-sheet-shadow` keyframes (reduced-motion gated).

### Verification

- `pnpm lint` + `pnpm build` pass (76 static pages, service worker 139 URLs). Visual QA passed: header/login/404/denied in both modes, desktop + mobile. Not visually tested: authenticated header (avatar dropdown), note routes (Threads 2/3).

## Thread 2 — Notes list: DONE

### Owner decisions (binding)

- Empty-state `<h3>` got `font-serif text-ink` per DESIGN.md "centered serif invitation".
- Unthemed card keeps original hover affordance: `transition-shadow hover:shadow-md focus-within:shadow-md` restored (owner prefers original effect over DESIGN's flat cards).
- Keep default `rounded-lg` radius on note cards both themed + unthemed (themed branch had lost it when `card` was dropped — fixed). Future: app-wide radius customization as part of the full-palette theme system (docs/theme-system.md), alongside palette/vibe + accent; not the per-note note-customize feature. Default radius stays for now.
- Hue colorways dark mode: owner picked Option C — `dark:bg-[color-mix(in_oklab,var(--color-<hue>-950)_15%,var(--paper-raised))]` + `dark:text-<hue>-300` (dialog role) and a full `darkTypographyThemePalette` counterpart (prose role: body hue-300, headings/bold/quotes hue-200, etc.) emitted as `&:where(.dark,.dark *)` nested block. QA contrast: dark themed card text 8.84:1 (rose) / 9.20:1 (blue).

### Deviations / notes

- Create button → `<Button variant="secondary">` with `gap-0 max-sm:h-fit! max-sm:p-3! max-sm:rounded-full max-sm:fixed ...` overrides to reproduce old `max-sm:button button-affix button-icon` behavior; `btn-light-sweep` kept, gradient recolored to accent/ink color-mix in globals.css.
- `note-tiny` root classes made conditional: themed cards keep only `dialog-<hue> shadow-theme-<hue>` (no competing `bg-paper-raised`); unthemed get `bg-paper-raised border border-hairline rounded-lg`.
- Delete row → `<Button variant="danger">` (hover fills destructive — slightly stronger than old secondary+red-text look; confirm visually).
- `main.bg-fancy` → `bg-dotgrid` on eton empty state only; `body:has(main.bg-fancy)` cascade and fancy-scrollbar rules kept for privacy/admin (deferred to Thread 7, see Thread 1 notes).
- Delete row: removed `rounded-none` so Button's `rounded-md` applies — sharp red hover fill was too harsh. Same fix applied to desktop sign-out row in profile dropdown (components/layouts/app-header.tsx, now `rounded-sm` matching sibling menu items in components/ui/menu.tsx).
- Dev-only visual-QA bypass added to auth.ts (Credentials provider gated `NODE_ENV === 'development'`, upserts user via addUser, signIn callback short-circuit). Prod build verified free of the provider. QA signs in with any email/password.
- Popover (dots menu) in note-tiny got explicit `bg-paper-raised border border-hairline` — was UA default white in dark.

### Verification (final)

- `pnpm lint` + `pnpm build` pass. Full visual QA (ui-reviewer, browser): dark+light, 1440+390 — unthemed card = paper-raised/hairline/rounded-lg + hover:shadow-sheet (ink-tinted, verified computed); themed = hue tint dark (Option C) + light pastel; themed hover keeps hue shadow; footer buttons 40×40 (p-3); dots popover dark paper + hairline; delete row danger rounded-md destructive hover; FAB mobile rounded-full 42×42 safe-area formula present; no horizontal overflow 390 both modes; sign-out rows rounded-sm equal 48px; console 0 errors. Known-LOW leftovers logged below.

### Deferred (LOW, logged for later threads)

- Card bottom-bar is hover/focus-revealed (`hidden group-has-[...popover-open]:flex focus-within:flex hover:flex sm:group-hover:flex`) — reachable on touch via focus-within, but no visual affordance before first tap. UX decision pending.
- `#main-menu` (mobile) Sign Out row had 2px height + radius mismatch vs Profile — fixed this thread; re-check siblings when app-header is revisited.
- `popovertarget`/`popovertargetaction` dead attributes alongside `commandfor` also exist in note-dialog.tsx etc. (Thread 3 scope) — causes console warning `popovertarget is ignored on elements with commandfor`. Clean those up in Thread 3+.
- Create-dialog legacy classes (bg-default, shadow-theme-slate, bg-zinc-50 dark:bg-zinc-900) — Thread 3 scope.
- Empty-state CTA copy randomizes per load ('New idea'/'New todo'/...) — intentional useRandomString, but consider one canonical string.

## Future (outside migration)

- Full-palette theme switching: design spec at docs/theme-system.md — deferred, additive, no current docs/CSS changes needed.
