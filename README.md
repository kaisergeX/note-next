# . - --- -.

[![Next.js](https://img.shields.io/badge/Next.js-000?style=for-the-badge&logo=vercel)](https://nextjs.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-fff?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com/)
[![neon](https://img.shields.io/badge/neon-000?style=for-the-badge&logo=postgresql&logoColor=white)](https://neon.com/)
[![Drizzle](https://img.shields.io/badge/drizzile-fff?style=for-the-badge&logo=drizzile&logoColor=4bb74a)](https://orm.drizzle.team/)

## Roadmap

<details>
<summary>Replace the old version</summary>

<sup>List in order of priority</sup>

- [ ] Note: Encrypt contents.
- [ ] Note: Recover notes that scheduled for deletion.
- [x] System: PWA supported.
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
- [ ] Preferences: Note - Option to disable modal view and always show full-size notes.[^1]
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
cp .env.example .env.local
```

## Installation

```bash
pnpm i
```

## Database

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
```

## Development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This project uses [`next/font`](https://nextjs.org/docs/app/getting-started/fonts) to automatically optimize and load custom Google Font.

## Coding convention

Check lint and format.

```bash
pnpm lint
```

[^1]: Currently using [parallel routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes) to show 2 types of view on the same route for the purpose of fast previewing, editing, and jumping between notes (modal view); can sharing URL, and focusing on edit contents like a document (full-size view).

[^2]: Unlock theme materials and games via the achievement system.

[^3]: Free and allow customizing fonts, theme colors, illustrations, icons, or just choose a seasonal theme. Retro and 2D platforming game theme in progress.
