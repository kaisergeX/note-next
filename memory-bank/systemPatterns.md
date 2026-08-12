# System Patterns

## Overview
This file documents the high‑level architecture and key design patterns employed in **note-next**.

### Core Architecture
- Monolithic Next.js application with server‑rendered pages.
- Uses Drizzle ORM for database access and migrations.
- Authentication via NextAuth and Google provider.
- Service worker registered at `public/sw.ts` for offline support.

### Design Patterns
- **Repository Pattern**: Data persistence is abstracted through repository interfaces.
- **Command Query Responsibility Segregation (CQRS)**: Read models separate from write operations where appropriate.
- **Event Sourcing**: Simple event logs capture state changes.
- **Dependency Injection**: Components receive services via context providers.

### Component Hierarchy
- Layout → Navigation → Note components → UI helpers.
- Each component is isolated with its own styling module using Tailwind CSS utilities.

## Future Enhancements
- Modular routing via `app/[locale]`.
- Advanced offline sync strategies.
- Extensible authentication providers.
