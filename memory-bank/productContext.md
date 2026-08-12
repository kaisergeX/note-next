# Product Context

## Purpose
The **note-next** application is designed to provide a lightweight, offline‑first note‑taking experience that scales from simple personal notes to collaborative knowledge bases.

## Why This Project Exists
- Users need a quick way to capture ideas, research snippets, and meeting notes without leaving the browser.
- Existing solutions often tie users to cloud services or require a heavy desktop app; this project aims to keep everything web‑based while still offering offline support via a service worker.
- The ability to work in multiple languages out of the box is essential for international teams and content creators.

## Problems It Solves
1. **Latency & Reliability** – Users experience lag or downtime when network connectivity is intermittent.
2. **Data Loss** – Without local persistence, unsaved notes can be lost on page refresh or navigation errors.
3. **Fragmented Tools** – Note‑taking often spans multiple tools; a single, cohesive app reduces context switching.

## How It Should Work
- Notes are stored in an PostgreSQL database accessed via Drizzle ORM.
- Authentication is handled by NextAuth with providers like Google.
- Internationalization (i18n) leverages the existing locale files under `app/[locale]`.
- The UI is built with Tailwind CSS, leveraging component‑driven design in `components/`.
- Offline capability is achieved through a service worker registered at `public/sw.ts`, providing a PWA‑style experience.

## User Experience Goals
- **Speed**: Instant feedback when typing or saving notes.
- **Responsiveness**: Works smoothly on mobile, tablet, and desktop sizes.
- **Simplicity**: Minimal clicks to create, edit, or delete a note.
- **Discoverability**: Clear navigation via the `components/navigation` structure.
- **Consistency**: Design language driven by Tailwind themes defined in `config/tailwindTheme.ts`.

---

> *This file was generated as part of the memory‑bank initialization.*