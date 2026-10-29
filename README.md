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
- [ ] Note: [Recovery and trash](docs/note-recovery-trash.md) — deployed; local checks, production recovery flow, manual cleanup, and endpoint protection pass. Automatic scheduled cleanup verification remains pending.
- [x] System: PWA supported.
- [x] Settings: [Account data actions](docs/archive/account-data-actions.md) — implemented and accepted; validation coverage and remaining manual checks are recorded in the archive.
  - [x] Delete account after Google verification and exact email confirmation.
  - [x] Move all notes to Trash with 30-day recovery.
- [x] Note: [Restore all and Empty Trash](docs/archive/trash-bulk-actions.md) — implemented with recoverable counts and read-only card previews; validation is recorded in the archive.
- [ ] Settings: Note
  - [ ] [Editor rebuild, autosave, local recovery, and conflict handling](docs/note-editor/overview.md) — Phases 0–2, conflict safety, and detailed text comparison accepted locally. Evidence, the unreproduced white-card report, and release/next-work limits are consolidated in the handoff.
  - [x] Persistent formatting toolbar with desktop groups and a compact mobile panel.
  - [x] Theme.
- [ ] Note: Drawable Mode,
- [ ] Note: Download/Export the content of selected or all notes to csv/xlsx/images.
- [ ] Note: Link to others.
- [x] Landing page.
- [ ] Settings: Note - Option to disable modal view and always show full-size notes.[^1]
- [ ] System: EXP, Level & Achievement system, sync with other apps.[^2]
- [x] Settings: [Appearance presets, color modes, account sync, and interactive preview](docs/archive/theme-system/overview.md).
- [ ] Settings: Advanced theme customization and seasonal artwork (separate scope).[^3]
- [ ] Integrate/Link with other apps in the ecosystems.
- [ ] Replace the old version.

</details>

## Documentation

Keep active feature plans directly under `docs/`, or in a feature folder when several documents are needed. Completed features belong in `docs/archive/`: use descriptive standalone filenames for single documents, and a feature folder for multiple documents. Use `overview.md` as a feature folder's entry point; fold routine follow-ups into existing documents instead of adding dated reports.

- [Note editor and persistence roadmap](docs/note-editor/overview.md): accepted direction, staged implementation, open decisions, and future encryption/offline constraints.

## Engines Requirements

`node@24` or later

`pnpm@11` or later

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

[^3]: Individual font/color editors, illustrations/icons, seasonal decoration, and retro/game presets.
