# Design Migration — Thread Status Log

Append one section per finished thread. Only record what the migration guide does NOT already say: owner decisions, deviations from scope, deferred issues, verification gaps. Never log per-file changes that fall inside a thread's listed scope.

Current state: Thread 7 (Misc + final cleanup) is complete. The owner authorized the remaining shared cleanup and homepage utility migration; the note-create `btn-light-sweep` remains by request.

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

## Thread 3 — Note editor: DONE

### Owner decisions (binding)

- Prose size refinement (DESIGN prose-body 1.0625rem/1.7) deferred by owner. Bare `prose` also styles privacy page (Thread 7) and note card previews (Thread 2); adding the size to `@utility prose` would clobber the typography plugin's `prose-sm`/`prose-lg` (custom utility emits later in cascade). If pursued later: scoped utility (e.g. `prose-note`) applied to note-editor + note-tiny preview only, or migrate privacy page first.
- Create dialog has no maximize/full-page link (no note id yet) — pre-existing behavior, kept; owner to confirm if it should appear post-save.

### Deviations / notes

- Actual note-detail path differs from the guide: `components/note/note-detail.tsx` does not exist; migrated file is `app/[locale]/(note)/eton/[id]/note-detail.tsx`. The modal shell (`eton/@modal/(.)[id]/note-detail-modal.tsx`) and `app/[locale]/(note)/full/eton/[id]/page.tsx` (pure redirect stub) were clean — untouched.
- Out-of-chunk (add-on): `components/ui/popover.tsx` popover surface got `text-ink` + `classNames`→`cn` — same native-Popover `canvastext` black-text bug fixed in menu.tsx earlier; affects note-customize/theme-picker popovers.
- Thread 1 deferred items closed here: full-page background strips fixed (sticky toolbar now `bg-paper/70 backdrop-blur-sm` + `border-b border-hairline`, blends with paper); `popovertarget`/`popovertargetaction` dead attrs were already cleaned upstream (no occurrences in chunk files — prior status note outdated). Create-dialog legacy classes (bg-zinc-50 dark:bg-zinc-900 etc.) lived in note-dialog.tsx and are migrated.
- Directional sticky shadows retinted to ink (`shadow-ink/10`) in note-dialog, note-detail (fixed menu + bottom bar); protected directional `shadow-[0_-8px_5px_-5px] shadow-theme-<hue>` strings kept byte-identical.
- Unthemed dialog fallback: `bg-zinc-50 dark:bg-zinc-900` → `bg-paper-raised shadow-sheet`; dialog radius fixed to spec `rounded-lg` (12px) with `max-sm:rounded-none` full-bleed kept; backdrop → `backdrop:bg-paper/50 backdrop:backdrop-blur`.
- Prose typography: `@utility prose` now sets Newsreader (`var(--font-serif)`), weight 400, headings/strong/bold 600, blockquote/em italic. Font-only — see deferred size decision. `prose-<hue>` and `prose-invert` untouched.
- `.k-dialog` in globals.css tokenized (`bg-paper-raised text-ink border-hairline`); zero direct usages in app/components — applied at runtime by `@kaiverse/k/ui` Dialog internals.
- `components/ui/rte-commands.tsx` internals untouched (own toggle styling system) — tokenize during a later thread if it reads as zinc in QA.
- Delete rows: `<Button variant="danger">` matching Thread 2's note-tiny pattern (`w-full border-none shadow-none`, default rounded-md).

### Verification

- `pnpm lint` + `pnpm build` pass (76 static pages). Grep of chunk files: zero legacy/raw classes; protected hue strings byte-identical; working tree = 7 code files + docs only.
- Visual QA (ui-reviewer, 3 rounds, real browser): dialog surface/radius/backdrop/title serif/shadow-sheet; bubble/floating/fixed toolbars tokenized; theme picker popover (swatches, accent ring, hue shadow) light+dark; colorways blue/rose/green light+dark unchanged; unthemed dark readable (no black-on-dark); delete row destructive hover fill; full-page toolbar blends with paper, dark bottom bar solid paper-raised; 390px no horizontal overflow (dark verified); console 0 errors.
- Gaps: 390px LIGHT sweep not run (low risk — light verified at 1440 on every surface); scroll-top affix trigger + scroll shadows not exercisable (test note too short to scroll — button present in DOM). Header Theme Switcher popover didn't open under programmatic clicks in round 2 (likely automation artifact — native Popover needs trusted events; component untouched this thread) — worth a manual click check.

## Thread 4 — AI roster + forms: DONE

### Deviations / notes

- The interview layout was already feature-gated and has no independent visual styles to migrate; verified without changes. New/edit route files are thin wrappers around the migrated shared form and required no edits.
- PersonaCombobox stays hand-rolled but now uses the shared Input and paper tokens, with Arrow/Home/End navigation and `aria-activedescendant` retained for active-option announcement.
- Owner-approved follow-up: roster dropdown actions and Eton delete actions use `MenuCustom` typed actions backed by square, borderless `MenuItemButton` rows, including the archive action's destructive hover treatment. The live-preview theme swatch picker stays on `PopoverBase` because it remains open during selection.

### Verification

- `pnpm lint` passed (TypeScript and ESLint; the changed chunk was formatted afterward; the only remaining warning is unrelated in `components/note/note-customize.tsx`).
- `pnpm build` passed (Next.js production build, 76 static pages, service worker precached 138 URLs).
- Chunk grep: zero `inputClass`, legacy classes, or raw zinc/red/gray color utilities. `git diff --check` clean. Visual QA remains unverified: the reviewer reached the Eton routes but was redirected to the custom login page, which only exposes Google sign-in; the dev Credentials provider was not reachable through the UI.

## Thread 5 — AI chat: DONE

### Deviations / notes

- `chat-bubble.tsx` is also used by `run-transcript.tsx`; its shared bubble styling changes the read-only run transcript too. No Thread 6 files were edited.
- Owner-approved follow-up after review: also brought the app-header Theme Switcher/Open main menu buttons and the chat drawer's New interview action up to the mobile target size. The review rubric's 44px target was applied to these controls and the composer.

### Verification

- `pnpm lint` and `pnpm build` pass (76 static pages; service worker precaches 137 URLs). Chunk grep found no legacy classes or raw palette colors; `git diff --check` is clean.
- Final visual re-review: PASS at 390px in light/dark and 1440px. Header buttons, sidebar toggle, composer, Send, Regenerate, New interview, and session actions measured at least 44px high; no overflow or layout regressions; no application console errors. The known dev HMR WebSocket failures remain intentionally unaddressed. Reviewer created a local test interview and sent one Vietnamese prompt to render the chat states.

## Thread 6 — AI runs + bulk: DONE

### Deviations / notes

- Run status badges now use the shared `<Badge>` mapping: pending → neutral, in_progress/done → active, failed → archived, following the migration guide's status mapping.
- Multiline textareas and the batch-size select have no shared primitive in `components/ui/`; their surfaces and focus states use semantic token utilities directly. Native text inputs were not introduced in this chunk.
- The development visual-QA credentials provider now accepts only the existing `qa@test.dev` user and performs a lookup instead of an upsert, so an email typo cannot create a stray local account.

### Verification

- `pnpm lint` passes using the bundled Node runtime and fallback pnpm command; TypeScript and full-repo ESLint pass. `pnpm build` passes (76 static pages; Serwist precached 137 URLs). `git diff --check` is clean, and the Thread 6 grep finds no legacy classes or raw zinc/red/gray palette utilities.
- Final dedicated `ui_reviewer` re-review: PASS at 1440px and 390px, light and dark, for `/en/ai/interview/runs`, `/en/ai/interview/runs/new`, `/en/ai/interview/runs/[runId]`, and `/en/ai/interview/bulk`. Mobile targets are at least 44px; labels are 12px muted; the reviewed focus rings are 2px accent; no horizontal overflow or app console errors.

## Thread 7 — Misc + final cleanup: DONE

### Deviations / notes

- Owner later authorized extending the cleanup to the homepage and shared components. Homepage placeholder copy remains intentionally unchanged from the earlier owner decision; only its design-system migration was done here.
- Kept `btn-light-sweep` on the note-create button at the owner's request. Removed the remaining retired shared utilities and recolored the global scrollbar and code surfaces with semantic tokens.
- Removed the unused generic `card`, `card-fancy`, `glass`, and bare `shadow-theme` utilities, and removed the `bg-fancy` body/scrollbar cascade after migrating the admin and privacy surfaces.
- Admin users review was intentionally skipped because the QA user is not an archivist and `/en/admin/users` requires that role.

### Verification

- `pnpm lint` and `pnpm build` pass; `git diff --check` is clean. Repo-wide legacy grep has no retired utilities or raw zinc/red/gray classes in `app/` or `components/`; `btn-light-sweep` is the sole requested retention.
- Dedicated UI review passed `/en` at 1440px and 390px in light/dark, with Newsreader display headings, no overflow, and no console errors. Homepage placeholder copy remains deferred.
- The Thread 7 route review covered `/en/user` and `/en/trust/privacy`; the admin page was skipped because it requires archivist access. Keyboard focus sequence and hover states remain unverified. The second review flagged a 34px desktop header user-menu target; it remains deferred to Thread 1 scope.
- The About page and note editor toolbar could not be visually reviewed because the QA browser session redirected to Google-only login; their code changes passed lint/build.

## Future (outside migration)

- Full-palette theme switching: design spec at docs/theme-system.md — deferred, additive, no current docs/CSS changes needed.
