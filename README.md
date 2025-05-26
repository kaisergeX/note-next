[![CI](https://github.com/kaisergeX/note-next/actions/workflows/ci.yml/badge.svg)](https://github.com/kaisergeX/note-next/actions/workflows/ci.yml)

# etoN - . - --- -.

[![Next.js](https://img.shields.io/badge/Next.js-000?style=for-the-badge&logo=vercel)](https://nextjs.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-fff?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![@neondatabase](https://img.shields.io/badge/@neondatabase-000?style=for-the-badge&logo=postgresql&logoColor=white)](https://vercel.com/marketplace/neon)
[![Drizzle](https://img.shields.io/badge/drizzile-fff?style=for-the-badge&logo=drizzile&logoColor=4bb74a)](https://orm.drizzle.team/)

## Roadmap

<details>
<summary>Replace the old version</summary>

<sup>List in order of priority</sup>

- [ ] Note: Recover notes that scheduled for deletion.
- [ ] Note: Encrypt contents.
- [ ] Preferences: Account
  - [ ] Delete account.
  - [ ] Delete all notes.
- [ ] Preferences: Note
  - [ ] Autosave (interval).
  - [x] Commands Menu type (fixed, or bubble & floating).
  - [x] Theme.
- [ ] Note: Drawable Mode,
- [ ] Note: Download/Export the content of selected or all notes to csv/xlsx/images.
- [ ] Note: Link to others.
- [ ] Landing page.
- [ ] Preferences: Note - Disable tiny view (dialog) and always view full-size notes.[^1]
- [ ] System: EXP, Level & Achievement system, sync with other apps.[^2]
- [ ] Preferences: Theme.[^3]
  - [ ] Theme editor & preview - Constantly update new themes.
- [ ] Integrate/Link with other apps in the ecosystems.
- [ ] Replace the old version.
</details>

## Engines Requirements

`node@20` or later

`pnpm@9` or later

## Environment Variables

Generate env file.

```bash
cp .env.example .env.development
```

## Installation

```bash
pnpm i
```

<!-- ## Database

Follow [@vercel/postgres docs](https://vercel.com/docs/storage/vercel-postgres/quickstart) but read section **Populate your database** below instead.

Then follow step 1 & 2 from [@vercel/kv docs](https://vercel.com/docs/storage/vercel-kv/quickstart#quickstart).

### Migration

Generate migrations based on schema.

```bash
pnpm db:gen
```

Execute & apply migrations

```bash
pnpm db:migrate
```

### Populate your database

```bash
pnpm db:seed
``` -->

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

[^1]: Currently using [parallel routes](https://nextjs.org/docs/app/building-your-application/routing/parallel-routes) to show 2 types of view on the same route for the purpose of fast previewing, editing, and jumping between notes (tiny view); can sharing URL, and focusing on edit contents like a document (full-size view). Still haven't found a way to opt-out the dialog view if user prefers full-size mode only. A possible solution is always open the note on a new tab.

[^2]: Unlock theme materials and games via the achievement system.

[^3]: Free and allow customizing fonts, theme colors, illustrations, icons, or just choose a seasonal theme. Retro and 2D platforming game theme in progress.
