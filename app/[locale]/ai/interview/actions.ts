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
import {type TranscriptTurn} from '~/db/schema/transcripts'
import {type ActionResult, type FieldError} from '~/lib/ai/action-result'
import {FeatureAccessError, requireFeatureAccess} from '~/lib/ai/feature-access'
import {isShapedUuid} from '~/lib/ai/id-shape'
import {LMStudioError, completeJson} from '~/lib/ai/lm-studio'
import {draftPersona, type PersonaDraft} from '~/lib/ai/persona-drafting'
import {
  draftPersonaInputSchema,
  personaInputSchema,
  toFieldErrors,
  type PersonaInput,
} from '~/lib/ai/persona-validation'
import {AI_DRAFT_TIMEOUT_MS, AI_LOCALES, LM_STUDIO_MODEL} from '~/config/ai'
import {
  createSingleTranscript,
  deleteTranscriptById,
  getTranscriptById,
  setTranscriptTitle,
} from '~/db/helper/transcripts'
import {requireAuth} from '~/server-utils'
import {z} from 'zod'

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
    // Draft JSON is big; constrained decoding on the local model can run long.
    const draft = await draftPersona(parsed.data, roster, {
      timeoutMs: AI_DRAFT_TIMEOUT_MS,
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
    // Draft JSON is big; constrained decoding on the local model can run long.
    const draft = await draftPersona(reparsed.data, undefined, {
      timeoutMs: AI_DRAFT_TIMEOUT_MS,
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

/**
 * Creates the transcript row for a single-interview session. The model id and
 * system prompt are SNAPSHOTTED here (ARCHITECT.md "Provenance"): the chat
 * route later reads them from the transcript, never from the (mutable) persona
 * row, so an A/B model swap or a regenerated prompt cannot reframe an
 * in-progress interview. Belt-and-braces on empty systemPrompt — the UI
 * blocks starting without one.
 */
export async function startInterviewAction(
  personaId: string,
): Promise<ActionResult<{transcriptId: string}>> {
  const noAccess = await requirePersonaInterviewAccess()
  if (noAccess) return noAccess

  const persona = await getPersonaById(personaId)
  if (!persona) {
    return {ok: false, reason: 'error', message: 'not found'}
  }

  const systemPrompt = persona.systemPrompt
  if (!systemPrompt || systemPrompt.trim().length === 0) {
    return {
      ok: false,
      reason: 'error',
      message: 'persona has no system prompt',
    }
  }

  // Guard on empty model: LM_STUDIO_MODEL defaults to '' in config/ai.ts,
  // and the transcript snapshots the model at session start — an empty id
  // would make every chat request target an invalid model.
  if (LM_STUDIO_MODEL.trim().length === 0) {
    return {ok: false, reason: 'error', message: 'model not configured'}
  }

  const transcript = await createSingleTranscript({
    personaId: persona.id,
    model: LM_STUDIO_MODEL,
    systemPrompt,
  })

  return {ok: true, data: {transcriptId: transcript.id}}
}

export async function renameInterviewSessionAction(
  transcriptId: string,
  rawTitle: string,
): Promise<ActionResult<{title: string | null}>> {
  // Server actions are publicly callable: cheap arg shape-checks run first,
  // before the auth gate and any DB access.
  if (!isShapedUuid(transcriptId) || typeof rawTitle !== 'string') {
    return {ok: false, reason: 'validation'}
  }

  const noAccess = await requirePersonaInterviewAccess()
  if (noAccess) return noAccess

  const transcript = await getTranscriptById(transcriptId)
  // Sessions are single-mode only; run-linked transcripts belong to batch runs.
  if (
    !transcript ||
    transcript.runId !== null ||
    transcript.mode !== 'single'
  ) {
    return {ok: false, reason: 'error', message: 'not found'}
  }

  const title = rawTitle.trim()
  if (title.length > 200) {
    return {ok: false, reason: 'validation'}
  }

  const stored = title.length === 0 ? null : title
  const row = await setTranscriptTitle(transcriptId, stored)
  if (!row) {
    return {ok: false, reason: 'error', message: 'not found'}
  }

  return {ok: true, data: {title: row.title}}
}

export async function deleteInterviewSessionAction(
  transcriptId: string,
): Promise<ActionResult<{deleted: boolean}>> {
  // See renameInterviewSessionAction: arg shape-check before the gate/DB.
  if (!isShapedUuid(transcriptId)) {
    return {ok: false, reason: 'validation'}
  }

  const noAccess = await requirePersonaInterviewAccess()
  if (noAccess) return noAccess

  const transcript = await getTranscriptById(transcriptId)
  // Sessions are single-mode only; run-linked transcripts belong to batch runs.
  // Missing row = already deleted (idempotent retry), not an error.
  if (!transcript) {
    return {ok: true, data: {deleted: false}}
  }
  if (transcript.runId !== null || transcript.mode !== 'single') {
    return {ok: false, reason: 'error', message: 'not found'}
  }

  const deleted = await deleteTranscriptById(transcriptId)
  return {ok: true, data: {deleted}}
}

/**
 * Names the conversation from its turns. Language mirrors what the
 * participants actually wrote — never hardcoded to a UI locale.
 */
const SESSION_TITLE_PROMPT = [
  'You name conversations. You will receive a transcript excerpt of a conversation between a user and an assistant.',
  'Write a short title for the conversation: at most 8 words.',
  'The title MUST be written in the same language the conversation participants actually use (if they write in Vietnamese, write the title in Vietnamese; any other language likewise).',
  'Return plain text only: no quotes, no trailing punctuation, no explanation.',
].join(' ')

const SESSION_TITLE_MAX_CHARS = 200

function buildSessionTitleDigest(turns: TranscriptTurn[]): string | undefined {
  const relevant = turns
    .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
    .slice(0, 6)
  if (relevant.length === 0) return undefined
  const digest = relevant
    .map(
      (turn) =>
        `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.content.slice(0, 400)}`,
    )
    .join('\n')
    .slice(0, 4000)
  return digest
}

export async function generateSessionTitleAction(
  transcriptId: string,
): Promise<ActionResult<{title: string | null}>> {
  // See renameInterviewSessionAction: arg shape-check before the gate/DB.
  if (!isShapedUuid(transcriptId)) {
    return {ok: false, reason: 'validation'}
  }

  const noAccess = await requirePersonaInterviewAccess()
  if (noAccess) return noAccess

  const transcript = await getTranscriptById(transcriptId)
  if (
    !transcript ||
    transcript.runId !== null ||
    transcript.mode !== 'single'
  ) {
    return {ok: false, reason: 'error', message: 'not found'}
  }

  // Already named: no-op, never re-run the LLM.
  if (transcript.title !== null) {
    return {ok: true, data: {title: transcript.title}}
  }

  const userCount = transcript.turns.filter(
    (turn) => turn.role === 'user',
  ).length
  const assistantCount = transcript.turns.filter(
    (turn) => turn.role === 'assistant',
  ).length
  if (userCount === 0 || assistantCount === 0) {
    return {ok: true, data: {title: null}}
  }

  const digest = buildSessionTitleDigest(transcript.turns)
  if (!digest) {
    return {ok: true, data: {title: null}}
  }

  try {
    const {title} = await completeJson(
      [
        {role: 'system', content: SESSION_TITLE_PROMPT},
        {role: 'user', content: digest},
      ],
      z.object({title: z.string().min(1).max(120)}),
    )
    const stored = title.trim()
    if (stored.length === 0) {
      // Whitespace-only LLM output: clear the title instead of storing it, so
      // auto-title can retry later and the sidebar keeps its preview
      // fallback (same clear-to-null semantics as the rename action).
      await setTranscriptTitle(transcript.id, null)
      return {ok: true, data: {title: null}}
    }
    const row = await setTranscriptTitle(
      transcript.id,
      stored.slice(0, SESSION_TITLE_MAX_CHARS),
    )
    return {ok: true, data: {title: row?.title ?? null}}
  } catch (err) {
    const mapped = mapLMStudioError(err)
    if (mapped) return mapped
    throw err
  }
}
