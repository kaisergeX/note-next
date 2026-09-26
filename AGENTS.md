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

## Special Notes

- Uses `dotenv-cli` for environment variable management in scripts
- Parallel notes view: Uses Next.js parallel routes `app/[locale]/(note)/` to serve both modal and full-size note views on the same route
- Use path aliases `~/*` (defined in tsconfig)
- Has a custom authentication configuration in `config/auth.ts`
- Implements localization using next-intl 4.13.7
- Utilizes serwist for PWA support (Service worker: `app/sw.ts` → `public/sw.js`)
- Uses `server-only` package for server-side rendering
- **AI features** (`app/[locale]/ai/`): shared parent for AI-driven features, isolated from the note-taking domain. Persona interview lives at
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
