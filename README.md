# Noteverse

[![CI](https://github.com/kaisergeX/note-next/actions/workflows/ci.yml/badge.svg)](https://github.com/kaisergeX/note-next/actions/workflows/ci.yml)

[Next.js](https://nextjs.org/) | [TailwindCSS](https://tailwindcss.com/) | [@vercel/postgres](https://vercel.com/storage/postgres) | [kysely](https://kysely.dev/)

## Environment Variables

Generate env file.

```bash
cp .env.example .env.development.local
```

## Installation
```bash
pnpm i
```

## Database

Follow [@vercel/postgres docs](https://vercel.com/docs/storage/vercel-postgres/quickstart) but read section **Populate your database** below instead.

### Populate your database
```bash
pnpm db-local:seed
```

### Need a migration?
```bash
pnpm db-local:migrate
```

## Development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load custom Google Font.

## Coding convention

Check lint and format.

```bash
pnpm lint
```
