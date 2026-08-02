# Tech Context

## Technologies Used
- **Framework**: Next.js (React, TypeScript)
- **Styling**: Tailwind CSS with custom theme defined in `config/tailwindTheme.ts`
- **Database**: PostgreSQL accessed via Drizzle ORM and SQLite for local dev/migrations
- **Auth**: NextAuth with Google provider (others can be added via config)
- **State Management**: React context / store pattern; server state handled through API routes
- **Build & Dev**: Vite/Next build scripts, PNPM workspaces, ESLint + Prettier, Docker compose for local dev.
- **PWA**: Service worker registered in `public/sw.ts` using Serwist.
- **Testing**: (placeholder) jest / vitest with React Testing Library

## Development Setup
- Clone repo, run `pnpm install`
- Use `pnpm dev` to start the Next.js dev server at http://localhost:3000
- Docker compose can spin up PostgreSQL and optionally a local auth provider.

## Technical Constraints
- Offline-first: must work without network; sync changes when connectivity restored.
- Cross‑platform (web, mobile via PWA)
- Secure note storage with encryption optional.
- Compatibility with Next.js 14+ features such as app router.

## Dependencies
- Next.js
- TypeScript
- Tailwind CSS + PostCSS
- Drizzle ORM & pg
- NextAuth
- Serwist
- PNPM

## Tool Usage Patterns
- Commands: `pnpm dev`, `pnpm build`, `pnpm test`
- Docker: `docker compose up -d`
- Migrations: `drizzle-kit` commands via scripts.
