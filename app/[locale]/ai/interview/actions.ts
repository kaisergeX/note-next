'use server'

import {eq} from 'drizzle-orm'
import {db} from '~/db'
import {
  getActiveRosterSummary,
  getPersonaById,
  listAllBackgroundTags,
} from '~/db/helper/personas'
import {
  personaStatusPgEnum,
  personasTable,
  type PersonaStatus,
} from '~/db/schema/personas'
import {type ActionResult, type FieldError} from '~/lib/ai/action-result'
import {FeatureAccessError, requireFeatureAccess} from '~/lib/ai/feature-access'
import {LMStudioError} from '~/lib/ai/lm-studio'
import {draftPersona, type PersonaDraft} from '~/lib/ai/persona-drafting'
import {
  draftPersonaInputSchema,
  personaInputSchema,
  toFieldErrors,
  type PersonaInput,
} from '~/lib/ai/persona-validation'
import {AI_LOCALES, AI_REQUEST_TIMEOUT_MS} from '~/config/ai'
import {requireAuth} from '~/server-utils'

/**
 * Ground rule: requireFeatureAccess is the real gate; the layout check is
 * UX only. Returns the no-access result, or undefined when allowed.
 */
async function requirePersonaInterviewAccess(): Promise<
  {ok: false; reason: 'no-access'} | undefined
> {
  const {userInfo} = await requireAuth()
  try {
    await requireFeatureAccess(userInfo.id, 'persona-interview')
  } catch (err) {
    if (err instanceof FeatureAccessError) {
      return {ok: false, reason: 'no-access'}
    }
    throw err
  }
}

/** Maps LMStudioError into an action result; undefined = not an LM Studio error, rethrow. */
function mapLMStudioError(err: unknown): ActionResult<never> | undefined {
  if (!(err instanceof LMStudioError)) return undefined
  if (
    err.kind === 'timeout' ||
    err.kind === 'unreachable' ||
    err.kind === 'auth'
  ) {
    return {ok: false, reason: 'offline', message: err.kind}
  }
  return {ok: false, reason: 'error', message: err.kind}
}

type ParsedPersonaInput =
  | {ok: true; data: PersonaInput}
  | {
      ok: false
      reason: 'validation'
      fieldErrors: Record<string, FieldError[]>
    }

function parsePersonaInput(raw: unknown): ParsedPersonaInput {
  const parsed = personaInputSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'validation',
      fieldErrors: toFieldErrors(parsed.error),
    }
  }
  return {ok: true, data: parsed.data}
}

export async function createPersonaAction(
  raw: unknown,
): Promise<ActionResult<{id: string}>> {
  const noAccess = await requirePersonaInterviewAccess()
  if (noAccess) return noAccess

  const parsed = parsePersonaInput(raw)
  if (!parsed.ok) return parsed

  const inserted = await db
    .insert(personasTable)
    // Nullable columns since the Phase-3 UX follow-up: undefined flows
    // through to SQL NULL for fields the save form doesn't provide.
    .values(parsed.data)
    .returning({id: personasTable.id})

  return {ok: true, data: {id: inserted[0]!.id}}
}

export async function updatePersonaAction(
  id: string,
  raw: unknown,
): Promise<ActionResult<{id: string}>> {
  const noAccess = await requirePersonaInterviewAccess()
  if (noAccess) return noAccess

  const parsed = parsePersonaInput(raw)
  if (!parsed.ok) return parsed

  // personaInputSchema fills in defaults ('draft' status, AI_DEFAULT_LOCALE)
  // whenever the caller omits status/locale. Those defaults must not leak
  // into updates: an omitted field means "leave the stored value alone", so
  // the patch below only carries status/locale when the raw payload actually
  // provided them. Provided values are re-checked here because the parse
  // result alone cannot tell "caller-provided" apart from "schema-defaulted".
  const rawRecord =
    typeof raw === 'object' && raw !== null
      ? (raw as Record<string, unknown>)
      : undefined
  const rawStatus = rawRecord?.status
  const rawLocale = rawRecord?.locale

  const patch: Partial<PersonaInput> & {updatedAt: Date} = {
    ...parsed.data,
    updatedAt: new Date(),
  }
  if (rawStatus !== undefined) {
    if (
      typeof rawStatus !== 'string' ||
      !personaStatusPgEnum.enumValues.includes(rawStatus as PersonaStatus)
    ) {
      return {
        ok: false,
        reason: 'validation',
        fieldErrors: {
          status: [{key: 'invalid', params: {value: String(rawStatus)}}],
        },
      }
    }
  } else {
    delete patch.status
  }
  if (rawLocale !== undefined) {
    if (typeof rawLocale !== 'string' || !(rawLocale in AI_LOCALES)) {
      return {
        ok: false,
        reason: 'validation',
        fieldErrors: {
          locale: [{key: 'invalid', params: {value: String(rawLocale)}}],
        },
      }
    }
  } else {
    delete patch.locale
  }

  await db
    .update(personasTable)
    // undefined fields (e.g. omitted generatedBio, or status/locale stripped
    // above when the caller omitted them) are skipped by drizzle's
    // mapUpdateSet; id/createdAt stay untouched, updatedAt refreshed here.
    .set(patch)
    .where(eq(personasTable.id, id))

  return {ok: true, data: {id}}
}

export async function generatePersonaAction(
  raw: unknown,
): Promise<ActionResult<PersonaDraft>> {
  const noAccess = await requirePersonaInterviewAccess()
  if (noAccess) return noAccess

  const parsed = draftPersonaInputSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'validation',
      fieldErrors: toFieldErrors(parsed.error),
    }
  }

  const roster = await getActiveRosterSummary()

  try {
    // Well under the 60s ceiling so DB writes keep headroom.
    const draft = await draftPersona(parsed.data, roster, {
      timeoutMs: AI_REQUEST_TIMEOUT_MS,
    })
    return {ok: true, data: draft}
  } catch (err) {
    const mapped = mapLMStudioError(err)
    if (mapped) return mapped
    throw err
  }
}

export async function regeneratePersonaBioAction(
  id: string,
): Promise<ActionResult<PersonaDraft>> {
  const noAccess = await requirePersonaInterviewAccess()
  if (noAccess) return noAccess

  const persona = await getPersonaById(id)
  if (!persona) {
    return {ok: false, reason: 'error', message: 'not found'}
  }

  // Rebuild a PersonaInput from the stored row, then re-validate it: the row
  // may predate schema changes or hold a locale outside AI_LOCALES. Without
  // this check, draftPersona's internal draftPersonaInputSchema.parse would throw
  // a ZodError that escapes as an unhandled 500; here a corrupt row instead
  // returns a normal error result.
  const personaInput: PersonaInput = {
    name: persona.name,
    gender: persona.gender ?? undefined,
    age: persona.age ?? undefined,
    locale: persona.locale as PersonaInput['locale'],
    region: persona.region,
    incomeBracket: persona.incomeBracket ?? undefined,
    occupation: persona.occupation ?? undefined,
    backgroundTags: persona.backgroundTags,
    personalitySliders: persona.personalitySliders,
    interviewStance: persona.interviewStance ?? undefined,
    quirksFreetext: persona.quirksFreetext ?? undefined,
    status: persona.status,
  }

  const reparsed = personaInputSchema.safeParse(personaInput)
  if (!reparsed.success) {
    return {
      ok: false,
      reason: 'error',
      message: 'persona row failed validation',
    }
  }

  try {
    const draft = await draftPersona(reparsed.data, undefined, {
      timeoutMs: AI_REQUEST_TIMEOUT_MS,
    })
    await db
      .update(personasTable)
      .set({
        generatedBio: draft.bio,
        systemPrompt: draft.systemPrompt,
        updatedAt: new Date(),
      })
      .where(eq(personasTable.id, id))
    return {ok: true, data: draft}
  } catch (err) {
    const mapped = mapLMStudioError(err)
    if (mapped) return mapped
    throw err
  }
}

export async function setPersonaStatusAction(
  id: string,
  status: PersonaStatus,
): Promise<ActionResult<{id: string}>> {
  const noAccess = await requirePersonaInterviewAccess()
  if (noAccess) return noAccess

  if (!personaStatusPgEnum.enumValues.includes(status)) {
    return {
      ok: false,
      reason: 'validation',
      message: `Invalid persona status: ${String(status)}`,
    }
  }

  await db
    .update(personasTable)
    .set({status, updatedAt: new Date()})
    .where(eq(personasTable.id, id))

  return {ok: true, data: {id}}
}

export async function listPersonaTagsAction(): Promise<ActionResult<string[]>> {
  const noAccess = await requirePersonaInterviewAccess()
  if (noAccess) return noAccess

  return {ok: true, data: await listAllBackgroundTags()}
}
