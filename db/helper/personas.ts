import {desc, eq, inArray, sql} from 'drizzle-orm'
import {db} from '..'
import {
  personasTable,
  type Persona,
  type PersonaStatus,
} from '../schema/personas'
import type {PersonalitySliders} from '../schema/transcripts'

export async function listPersonasByStatuses(
  statuses: PersonaStatus[],
): Promise<Persona[]> {
  if (statuses.length === 0) return []
  return await db
    .select()
    .from(personasTable)
    .where(inArray(personasTable.status, statuses))
    .orderBy(desc(personasTable.createdAt))
}

export async function getPersonaById(id: string): Promise<Persona | undefined> {
  const [row] = await db
    .select()
    .from(personasTable)
    .where(eq(personasTable.id, id))
    .limit(1)
  return row
}

/** Fetch full persona rows for a known id set (run items); empty ids → []. */
export async function listPersonasByIds(ids: string[]): Promise<Persona[]> {
  if (ids.length === 0) return []
  return await db
    .select()
    .from(personasTable)
    .where(inArray(personasTable.id, ids))
}

export async function listAllBackgroundTags(): Promise<string[]> {
  const rows = await db.execute<{tag: string}>(
    sql`select distinct unnest(${personasTable.backgroundTags}) as tag from ${personasTable}`,
  )
  return [...new Set(rows.map((row) => row.tag))].sort()
}

export type ActiveRosterEntry = {
  name: string
  region: string
  occupation: string | null
  backgroundTags: string[]
  topSliders: string
}

/**
 * Shared between buildActiveRosterSummary and the export renderers so the
 * roster summary and the export files always describe a slider the same way.
 */
export const SLIDER_POLAR_LABELS: Record<
  keyof PersonalitySliders,
  [string, string]
> = {
  calm_anxious: ['calm', 'anxious'],
  optimistic_cynical: ['optimistic', 'cynical'],
  frugal_spendthrift: ['frugal', 'spendthrift'],
}

/**
 * Pure: filter to `active` personas and map to the roster-summary shape.
 * `topSliders` = the top-2 slider axes by |value-50| distance with direction
 * (e.g. "anxious(85), spendthrift(78)") — deterministic and testable.
 */
export function buildActiveRosterSummary(
  personas: Persona[],
): ActiveRosterEntry[] {
  return personas
    .filter((persona) => persona.status === 'active')
    .map((persona) => {
      const sliders = persona.personalitySliders
      const ranked = (
        Object.keys(SLIDER_POLAR_LABELS) as Array<keyof PersonalitySliders>
      )
        .map((key) => {
          const value = sliders[key] ?? 50
          return {
            label: `${SLIDER_POLAR_LABELS[key][value >= 50 ? 1 : 0]}(${value})`,
            distance: Math.abs(value - 50),
          }
        })
        .sort((a, b) => b.distance - a.distance)
      return {
        name: persona.name,
        region: persona.region,
        occupation: persona.occupation,
        backgroundTags: persona.backgroundTags,
        topSliders: ranked
          .slice(0, 2)
          .map((item) => item.label)
          .join(', '),
      }
    })
}

export async function getActiveRosterSummary(): Promise<ActiveRosterEntry[]> {
  return buildActiveRosterSummary(await listPersonasByStatuses(['active']))
}
