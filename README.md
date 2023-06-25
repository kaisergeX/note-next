[![CI](https://github.com/kaisergeX/note-next/actions/workflows/ci.yml/badge.svg)](https://github.com/kaisergeX/note-next/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/next)](https://github.com/vercel/next.js)

# etoN - . - --- -.

[![Next.js](https://img.shields.io/badge/Next.js-000?style=for-the-badge&logo=vercel)](https://nextjs.org/) 
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-fff?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![@vercel/postgres](https://img.shields.io/badge/@vercel/postgres-000?style=for-the-badge&logo=postgresql&logoColor=white)](https://vercel.com/storage/postgres)
[![Drizzle](https://img.shields.io/badge/drizzile-fff?style=for-the-badge&logo=drizzile&logoColor=4bb74a)](https://orm.drizzle.team/)

## Environment Variables

Generate env file.

```bash
cp .env.example .env.development
```

## Installation
```bash
pnpm i
```

## Database

Follow [@vercel/postgres docs](https://vercel.com/docs/storage/vercel-postgres/quickstart) but read section **Populate your database** below instead.

### Migration
Generate migrations based on schema.
```bash
pnpm db:gen
```

Execute migrations
```bash
pnpm db:migrate
```

### Populate your database
```bash
pnpm db:seed
```

### Pull DDL from existing database and generate schema

```bash
pnpm db:pull
```

<sup>
  schema.ts file will be stored inside drizzle folder.
</sup>

<strong>Note:</strong> Since this project setup assuming that the database will be created from scratch.<br/>
Please makes sure to update related schema in `db/schema/*` based on generated schema file or import schema from it instead.

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
