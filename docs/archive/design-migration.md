# Paper & Ink Migration History

The route-by-route migration and shared cleanup are complete. `DESIGN.md` is the current visual specification. This archive preserves decisions and verification limits that may help with later design work.

## Durable implementation decisions

- Note hues and their `dialog-<hue>`, `prose-<hue>`, `picker-<hue>`, `shadow-theme-<hue>`, and `border-theme-<hue>` utilities were preserved.
- Unthemed note cards retain their hover shadow; themed note cards retain their hue shadows. The note-create button keeps `btn-light-sweep` by owner request.
- The note prose typography change is font-only; changing its size was deferred because the generic prose utility also affects other surfaces.
- Menu, combobox, and form work retained custom styling and native Popover behavior while adding shared primitives and keyboard support where appropriate.
- The homepage placeholder copy was intentionally left for a separate design task.

## Verification record and gaps

The completed migration was checked with lint and production builds. The final repo-wide search found no retired styling utilities or raw zinc/red/gray palette classes in `app/` or `components/`, aside from the retained `btn-light-sweep` and protected note-hue system. Visual reviews covered key routes in light/dark themes and desktop/mobile widths.

Some checks were constrained by access or interaction: the admin users page required an archivist account; authenticated header menus, some note routes, and a few keyboard/hover states were not fully reviewed in all rounds. These are historical gaps, not an open migration plan. See the original migration details in git history if needed.
