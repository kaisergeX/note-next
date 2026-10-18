# AGENTS.md

## Overview

This is a Next.js 16+ application using TypeScript, Tailwind CSS, and Drizzle ORM with PostgreSQL. The project uses pnpm as the package manager and follows a monorepo-style structure for a single application.

## Key Commands

- `pnpm dev` - Start development server
- `pnpm build` - Build the application
- `pnpm lint` - Run ESLint and TypeScript checks
- `pnpm format` - Format code with Prettier
- `pnpm db:gen` - Generate database migrations
- `pnpm db:migrate` - Apply database migrations
- `pnpm db:seed` - Populate database with seed data

## Database Setup

1. Copy `.env.example` to `.env.local`
2. Set required environment variables including `DATABASE_URL`
3. Run `pnpm db:gen` to generate migrations
4. Run `pnpm db:migrate` to apply migrations
5. Run `pnpm db:seed` to populate with sample data

## Framework Details

- Next.js 16, App Router with locale routing under `app/[locale]/`
- TypeScript 7.0+
- Tailwind CSS 4.3+
- Drizzle ORM 1.0.0-rc.4 with PostgreSQL (Schema: `db/schema/`)
- Authentication via NextAuth.js 5.0.0-beta.32
- Tiptap editor for rich text editing
- State management: Zustand stores (check `lib/stores/`)

## Design System

- `DESIGN.md` (repo root) is the source of truth for the app's look ("Paper & Ink"). Read it before any UI change.
- Tokens are CSS vars in `app/globals.css` (`:root` + `.dark`) mapped via `@theme inline`. Use semantic utilities: `bg-paper`, `bg-paper-raised`, `text-ink`, `text-ink-muted`, `border-hairline`, `text-accent`, `bg-destructive`, `text-success`, `shadow-sheet`, `font-serif`, `bg-dotgrid`. Dark mode is automatic (vars flip) — no `dark:` pair needed for token colors.
- Primitives live in `components/ui/` (`button.tsx`, `input.tsx`, `badge.tsx`) — use them for new UI instead of raw classes.
- **Tailwind 4 syntax only.** Never generate v3-era syntax: no `tailwind.config.*` files, no `content`/`safelist` arrays, no `darkMode:` key, no JS theme extensions. Use `@theme`, `@utility`, `@custom-variant`, `@plugin`, `@source inline` in CSS. Custom plugins load via `config/tailwindTypographyPlugin.mjs` + `config/tailwindNoteThemePlugin.mjs`.

## Special Notes

- Uses `dotenv-cli` for environment variable management in scripts
- **Visual QA authentication:** `auth.ts` registers a development-only Credentials provider for the existing `qa@test.dev` user. The provider checks the email and ignores the password; the user must already exist in the local database. The current `/[locale]/login` page only renders Google sign-in, so use a same-origin POST to `/api/auth/callback/credentials` with a CSRF token and `email=qa@test.dev` to sign in during browser review. AI interview routes also require a `feature_access` row for `persona-interview`, which the project owner grants manually. QA users and feature grants may not be present on every device/database. If either is missing, ask the owner to provision it, then continue the review after they confirm; do not treat the route as permanently blocked or try to grant access yourself.
- Parallel notes view: Uses Next.js parallel routes `app/[locale]/(note)/` to serve both modal and full-size note views on the same route
- Use path aliases `~/*` (defined in tsconfig)
- Has a custom authentication configuration in `config/auth.ts`
- Implements localization using next-intl 4.13.7
- Utilizes serwist for PWA support (Service worker: `app/sw.ts` → `public/sw.js`)
- Uses `server-only` package for server-side rendering
- **AI features** (`app/[locale]/ai/`): Implementing. Shared parent for AI-driven features, isolated from the note-taking domain. Persona interview lives at
  `app/[locale]/ai/interview/` (own schema files, own layout, own `feature_access` gate); a future companion-chat feature will live at
  `app/[locale]/ai/companion/` as a sibling.
  Read `docs/ai/PRD.md`, `docs/ai/ARCHITECTURE.md`, `docs/ai/PERSONA-SCHEMA.md`, and `docs/ai/BUILD-PLAN.md` before touching anything under `ai/interview/` or its schema files.

## Testing & Quality

- Linting and type checking are combined in the `pnpm lint` script
- Code is formatted with Prettier using Tailwind plugin

## Important Constraints

- Import paths must not use path aliases in `db/schema/*.ts` (required by Drizzle)
- Service worker must use `serwist.ts` entry point, output to `public/sw.js`
- ESLint disables `no-undef` as Next.js types are injected globally during dev

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
