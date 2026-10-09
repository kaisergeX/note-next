'use server'

import {eq, inArray} from 'drizzle-orm'
import {db} from '~/db'
import {
  deleteDraftPersonaById,
  getActiveRosterSummary,
  getDraftGuardRosterSummary,
  getPersonaById,
  listAllBackgroundTags,
} from '~/db/helper/personas'
import {personaHasRunItems} from '~/db/helper/runs'
import {
  claimNextRunItem,
  createRun,
  finishRunIfComplete,
  getRunById,
  getRunProgress,
  markRunItemStatus,
  retryFailedRunItems,
  type RunProgress,
} from '~/db/helper/runs'
import {
  personaStatusPgEnum,
  personasTable,
  type Persona,
  type PersonaStatus,
} from '~/db/schema/personas'
import {
  type RunItemStatus,
  type PersonalitySliders,
  type TranscriptTurn,
} from '~/db/schema/transcripts'
import {type ActionResult, type FieldError} from '~/lib/ai/action-result'
import {FeatureAccessError, requireFeatureAccess} from '~/lib/ai/feature-access'
import {isShapedUuid} from '~/lib/ai/id-shape'
import {
  LMStudioError,
  complete,
  completeJson,
  type LMStudioMessage,
} from '~/lib/ai/lm-studio'
import {buildInterviewSystemMessage} from '~/lib/ai/persona-style'
import {
  draftPersona,
  draftPersonaBatch,
  type PersonaDraft,
} from '~/lib/ai/persona-drafting'
import {
  draftPersonaInputSchema,
  personaInputSchema,
  toFieldErrors,
  type PersonaInput,
} from '~/lib/ai/persona-validation'
import {
  AI_DRAFT_TIMEOUT_MS,
  AI_DEFAULT_LOCALE,
  AI_LOCALES,
  AI_REQUEST_TIMEOUT_MS,
  LM_STUDIO_MODEL,
} from '~/config/ai'
import {
  appendTranscriptTurns,
  createRunTranscript,
  createSingleTranscript,
  deleteTranscriptById,
  findRunTranscript,
  getTranscriptById,
  personaHasTranscripts,
  setTranscriptTitle,
} from '~/db/helper/transcripts'
import {requireAuth} from '~/server-utils'
import {
  RUN_SCRIPT_MAX_QUESTION_LENGTH,
  RUN_SCRIPT_MAX_QUESTIONS,
  parseQuestionScript,
  looksLikeSectionHeader,
  repairVerbatimLine,
  stripListMarker,
} from '~/lib/ai/question-script'
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

  try {
    const transcript = await createSingleTranscript({
      personaId: persona.id,
      model: LM_STUDIO_MODEL,
      systemPrompt,
    })
    return {ok: true, data: {transcriptId: transcript.id}}
  } catch (_) {
    return {ok: false, reason: 'error', message: 'transcript insert failed'}
  }
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

const RUN_CONTEXT_MAX_CHARS = 2000

/** Server-side only: upper bound on personas per batch run. */
const MAX_RUN_PERSONAS = 100

/**
 * Creates a batch run + one pending run_item per eligible persona. Archived
 * personas and personas without a usable systemPrompt are skipped (reported
 * by name, no run_item) — matching startInterviewAction's guard, applied per
 * persona instead of failing the whole run.
 */
export async function createRunAction(
  rawScript: unknown,
  rawPersonaIds: unknown,
  rawContext?: unknown,
): Promise<ActionResult<{runId: string; skipped: string[]}>> {
  // Cheap pure validation before the gate: no auth/DB work on malformed args.
  if (typeof rawScript !== 'string') {
    return {
      ok: false,
      reason: 'validation',
      message: 'question script must be a string',
    }
  }
  // Cap AFTER splitting so a pasted paragraph of many questions is counted
  // like a typed list, not as one long line; over the cap is a validation
  // error, never a silent truncation.
  const questionScript = parseQuestionScript(rawScript)
  if (
    questionScript.length < 1 ||
    questionScript.length > RUN_SCRIPT_MAX_QUESTIONS ||
    questionScript.some(
      (question) => question.length > RUN_SCRIPT_MAX_QUESTION_LENGTH,
    )
  ) {
    return {
      ok: false,
      reason: 'validation',
      message: `question script must contain 1-${RUN_SCRIPT_MAX_QUESTIONS} non-empty lines of at most ${RUN_SCRIPT_MAX_QUESTION_LENGTH} characters`,
    }
  }
  // Optional run-level context: trimmed, capped, empty → null (SQL NULL).
  const researchContext =
    typeof rawContext === 'string'
      ? (() => {
          const trimmed = rawContext.trim()
          return 0 < trimmed.length && trimmed.length <= RUN_CONTEXT_MAX_CHARS
            ? trimmed
            : null
        })()
      : null
  if (
    typeof rawContext === 'string' &&
    rawContext.trim().length > RUN_CONTEXT_MAX_CHARS
  ) {
    return {
      ok: false,
      reason: 'validation',
      message: `context must be at most ${RUN_CONTEXT_MAX_CHARS} characters`,
    }
  }
  if (
    !Array.isArray(rawPersonaIds) ||
    rawPersonaIds.length < 1 ||
    !rawPersonaIds.every(
      (id): id is string => typeof id === 'string' && isShapedUuid(id),
    )
  ) {
    return {
      ok: false,
      reason: 'validation',
      message: 'persona ids must be a non-empty array of valid ids',
    }
  }
  const personaIds = [...new Set(rawPersonaIds)]
  if (personaIds.length > MAX_RUN_PERSONAS) {
    return {
      ok: false,
      reason: 'validation',
      message: `at most ${MAX_RUN_PERSONAS} personas per run`,
    }
  }

  const noAccess = await requirePersonaInterviewAccess()
  if (noAccess) return noAccess

  const personas = await db
    .select()
    .from(personasTable)
    .where(inArray(personasTable.id, personaIds))
  const skipped: string[] = []
  const eligible: Persona[] = []
  for (const id of personaIds) {
    const persona = personas.find((row) => row.id === id)
    // Missing from the DB: dropped silently — there is no name to report.
    if (!persona) continue
    if (
      persona.status === 'archived' ||
      !persona.systemPrompt ||
      persona.systemPrompt.trim().length === 0
    ) {
      skipped.push(persona.name)
      continue
    }
    eligible.push(persona)
  }
  if (eligible.length === 0) {
    return {
      ok: false,
      reason: 'validation',
      message: 'no eligible personas for this run',
    }
  }

  const run = await createRun({
    questionScript,
    personaIds: eligible.map((persona) => persona.id),
    researchContext,
  })

  return {ok: true, data: {runId: run.id, skipped}}
}

const EXTRACT_MAX_INPUT_CHARS = 20000

/**
 * Plain-text protocol instead of completeJson: grammar-constrained json_schema
 * degrades long Vietnamese verbatim copies (tokenizer artifacts: '/'→'.',
 * stray apostrophes, injected foreign glyphs). Unconstrained generation at low
 * temperature copies cleanly; the app-side parsing in extractQuestionsAction
 * is the validation layer.
 */
const EXTRACT_QUESTIONS_SYSTEM_PROMPT =
  'Bạn là trợ lý trích xuất. CHỈ copy lại nguyên văn các câu hỏi trong văn bản người dùng.'

const EXTRACT_QUESTIONS_RULES = [
  'Quy tắc bắt buộc:',
  '- Trả về CHỈ các câu hỏi, mỗi câu một dòng, đúng thứ tự xuất hiện trong văn bản.',
  '- Giữ NGUYÊN VĂN từng câu hỏi: giữ nguyên mọi dấu câu, dấu "/", dấu nháy, ký tự đặc biệt — không diễn đạt lại, không sửa lỗi, không dịch, không gộp, không thêm bớt gì.',
  '- Không đánh số, không gạch đầu dòng, không tiêu đề mục, không lời bình, không dòng trống.',
  '- Nếu văn bản không có câu hỏi nào, trả về đúng một chữ: EMPTY',
].join('\n')

/**
 * Review-step helper for the "Detect questions" button (PURE extraction, no
 * DB writes): pulls every question out of a pasted list or paragraph
 * VERBATIM — original wording, original order. The user then edits the
 * textarea before Create, which consumes the lines as-is (createRunAction
 * stays LLM-free).
 */
export async function extractQuestionsAction(
  rawText: unknown,
): Promise<ActionResult<{questions: string[]}>> {
  // Cheap pure arg shape-checks run first (house convention); the access
  // gate (and the LLM call after it) only runs for well-formed input.
  if (typeof rawText !== 'string') {
    return {
      ok: false,
      reason: 'validation',
      message: 'text must be a string',
    }
  }
  const text = rawText.trim()
  if (text.length === 0 || text.length > EXTRACT_MAX_INPUT_CHARS) {
    return {
      ok: false,
      reason: 'validation',
      message: `text must be 1-${EXTRACT_MAX_INPUT_CHARS} characters`,
    }
  }

  // Gate after the cheap arg checks; isShapedUuid is not applicable here
  // (no id argument).
  const noAccess = await requirePersonaInterviewAccess()
  if (noAccess) return noAccess

  try {
    // temperature 0.1 (near-greedy): verbatim copies must not drift — see the
    // plain-text protocol comment above EXTRACT_QUESTIONS_SYSTEM_PROMPT.
    const response = await complete(
      [
        {role: 'system', content: EXTRACT_QUESTIONS_SYSTEM_PROMPT},
        {role: 'user', content: `${text}\n\n${EXTRACT_QUESTIONS_RULES}`},
      ],
      {timeoutMs: AI_REQUEST_TIMEOUT_MS, temperature: 0.1},
    )

    // App-side parsing is the validation layer (see the plain-text protocol
    // comment): the model's free-text answer is split line by line, stripped
    // of list markers, and re-checked against the same caps createRunAction
    // enforces (over the cap is an error, never a silent truncation).
    const trimmedResponse = response.trim()
    // "EMPTY." / "empty" / trailing punctuation variants count as the
    // sentinel; whitespace-only responses count as empty too.
    if (trimmedResponse.length === 0 || /^EMPTY\b/i.test(trimmedResponse)) {
      return {
        ok: false,
        reason: 'validation',
        message: 'no questions detected',
      }
    }
    // Verbatim repair: model output is used ONLY for segmentation; the text
    // of each question is restored from the researcher's own paste so
    // tokenizer artifacts ('/'→'.', stray glyphs) cannot survive. Lines that
    // match no source line well enough keep the model's text as-is.
    const sourceLines = text
      .split(/\r?\n/)
      .map(stripListMarker)
      .filter((line) => line.length > 0)
    const questions = trimmedResponse
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => repairVerbatimLine(stripListMarker(line), sourceLines))
      // '?'-less section headers ("II. CHUYÊN MÔN → …") are dropped, but
      // '?'-less imperative questions ("Cho biết anh/chị…") are kept — they
      // still pass createRunAction's validation downstream.
      .filter((line) => line.includes('?') || !looksLikeSectionHeader(line))
    if (
      questions.length < 1 ||
      questions.length > RUN_SCRIPT_MAX_QUESTIONS ||
      questions.some(
        (question) => question.length > RUN_SCRIPT_MAX_QUESTION_LENGTH,
      )
    ) {
      return {
        ok: false,
        reason: 'validation',
        message: `question script must contain 1-${RUN_SCRIPT_MAX_QUESTIONS} non-empty lines of at most ${RUN_SCRIPT_MAX_QUESTION_LENGTH} characters`,
      }
    }
    return {ok: true, data: {questions}}
  } catch (err) {
    const mapped = mapLMStudioError(err)
    if (mapped) return mapped
    throw err
  }
}

export type RunStepItem = {
  runItemId: string
  personaName: string
  /**
   * Mirrors the stored run_item status after the step: a non-final scripted
   * question leaves the item `in_progress` (only the LAST question settles
   * it), so the client badge must not flip to `done` mid-script.
   */
  status: RunItemStatus
  error: string | null
}

export type RunStepResult =
  | {done: true; progress: RunProgress}
  | {
      done: false
      item: RunStepItem
      /** Why the step failed; 'offline' lets the client stop the loop. */
      reason?: 'offline' | 'error'
      progress: RunProgress
    }

/**
 * Terminal item outcome: settle the run row first (the item that just
 * finished may have been the last claimable one — without this a finished
 * run can stay `in_progress` forever), then re-derive progress for the
 * client. Used after EVERY terminal item outcome, success or failure.
 */
async function finishItem(
  runId: string,
  item: RunStepItem,
  reason?: 'offline' | 'error',
): Promise<Extract<RunStepResult, {done: false}>> {
  await finishRunIfComplete(runId)
  return {
    done: false,
    item,
    ...(reason === undefined ? {} : {reason}),
    progress: await getRunProgress(runId),
  }
}

/**
 * One question-step for one persona (ARCHITECTURE.md "Batch execution
 * model"): claim the next run_item, ask the next scripted question through
 * LM Studio, append the Q&A pair to the persona's run transcript, advance
 * the item. The browser tab owns the loop; this action owns one step.
 */
export async function runNextStepAction(
  runId: string,
): Promise<ActionResult<RunStepResult>> {
  // Server actions are publicly callable: cheap arg shape-checks run first,
  // before the auth gate and any DB access.
  if (!isShapedUuid(runId)) {
    return {ok: false, reason: 'validation'}
  }

  const noAccess = await requirePersonaInterviewAccess()
  if (noAccess) return noAccess

  const run = await getRunById(runId)
  if (!run) {
    return {ok: false, reason: 'validation', message: 'run not found'}
  }
  if (run.status === 'done') {
    return {
      ok: true,
      data: {done: true, progress: await getRunProgress(runId)},
    }
  }

  const item = await claimNextRunItem(runId)
  if (!item) {
    // Nothing claimable: everything is done or failed. Settle the run row
    // explicitly — without this the run can stay `in_progress` forever when
    // every item was already terminal (e.g. after a resume or retry race).
    await finishRunIfComplete(runId)
    return {
      ok: true,
      data: {done: true, progress: await getRunProgress(runId)},
    }
  }

  const persona = await getPersonaById(item.personaId)
  if (!persona) {
    await markRunItemStatus(item.id, 'failed', 'persona missing')
    return {
      ok: true,
      data: await finishItem(
        runId,
        {
          runItemId: item.id,
          personaName: '',
          status: 'failed',
          error: 'persona missing',
        },
        'error',
      ),
    }
  }

  // Guard on empty model: LM_STUDIO_MODEL defaults to '' in config/ai.ts,
  // and the transcript snapshots the model at first step — an empty id would
  // make every step request target an invalid model. Mirrors
  // startInterviewAction; here the failure is per-item, not run-fatal.
  if (LM_STUDIO_MODEL.trim().length === 0) {
    const error = 'model not configured'
    await markRunItemStatus(item.id, 'failed', error)
    return {
      ok: true,
      data: await finishItem(
        runId,
        {
          runItemId: item.id,
          personaName: persona.name,
          status: 'failed',
          error,
        },
        'error',
      ),
    }
  }
  const systemPrompt = persona.systemPrompt
  if (!systemPrompt || systemPrompt.trim().length === 0) {
    const error = 'persona has no system prompt'
    await markRunItemStatus(item.id, 'failed', error)
    return {
      ok: true,
      data: await finishItem(
        runId,
        {
          runItemId: item.id,
          personaName: persona.name,
          status: 'failed',
          error,
        },
        'error',
      ),
    }
  }

  let transcript = await findRunTranscript(persona.id, runId)
  if (!transcript) {
    try {
      transcript = await createRunTranscript({
        personaId: persona.id,
        runId,
        model: LM_STUDIO_MODEL,
        systemPrompt,
      })
    } catch (err) {
      // Lost a create race (double-tab / retry while the first insert was in
      // flight): the partial unique index rejected the duplicate — reuse the
      // winner's row so the step continues instead of surfacing a 500.
      transcript = await findRunTranscript(persona.id, runId)
      if (!transcript) throw err
    }
  }

  // Each completed step appends exactly one user + one assistant pair, so the
  // number of user turns equals the number of questions already asked.
  const questionIndex = transcript.turns.filter(
    (turn) => turn.role === 'user',
  ).length
  if (questionIndex >= run.questionScript.length) {
    // Script shrunk or already fully answered: the item counts as complete.
    await markRunItemStatus(item.id, 'done')
    return {
      ok: true,
      data: await finishItem(runId, {
        runItemId: item.id,
        personaName: persona.name,
        status: 'done',
        error: null,
      }),
    }
  }
  const question = run.questionScript[questionIndex]!

  const messages: LMStudioMessage[] = [
    // Snapshot from transcript creation — never persona.systemPrompt, which
    // the owner may have regenerated since the run began (same rule as the
    // chat route). Persona snapshot first, speech contract second, then the
    // optional run-level research context (why the persona is being asked —
    // never to be read aloud).
    {
      role: 'system',
      content:
        run.researchContext && run.researchContext.trim().length > 0
          ? `${buildInterviewSystemMessage(transcript.systemPrompt)}\n\nBỐI CẢNH PHỎNG VẤN (để người được phỏng vấn hiểu vì sao được hỏi, KHÔNG được đọc lại thành tiếng): ${run.researchContext.trim()}`
          : buildInterviewSystemMessage(transcript.systemPrompt),
    },
  ]
  for (const turn of transcript.turns) {
    // Defensive: 'system' turns must never reach the completion as a mid-
    // conversation role — the system prompt comes solely from the snapshot.
    if (turn.role === 'system') continue
    if (turn.role === 'user' || turn.role === 'assistant') {
      messages.push({role: turn.role, content: turn.content})
    }
  }
  messages.push({role: 'user', content: question})

  const timestamp = new Date().toISOString()
  try {
    // Batch steps are non-streaming (ARCHITECTURE.md "Batch execution model").
    const answer = await complete(messages, {timeoutMs: AI_REQUEST_TIMEOUT_MS})
    // Single-statement append so the Q&A pair lands atomically — two separate
    // appends could interleave with another writer and desync the
    // user-turn-derived questionIndex.
    await appendTranscriptTurns(transcript.id, [
      {role: 'user', content: question, timestamp},
      {role: 'assistant', content: answer, timestamp},
    ])
    // A run_item covers one persona's WHOLE questionScript; questionIndex is
    // the count of user turns already asked. Only the LAST scripted question
    // settles the item — marking it done after every question would stop
    // multi-question runs at Q1. Between its own questions the item stays
    // `in_progress` (claimNextRunItem re-claims it, after pending items, so
    // personas alternate round-robin). finishRunIfComplete is harmless here:
    // this in_progress item keeps the run `in_progress`.
    if (questionIndex + 1 >= run.questionScript.length) {
      await markRunItemStatus(item.id, 'done')
      return {
        ok: true,
        data: await finishItem(runId, {
          runItemId: item.id,
          personaName: persona.name,
          status: 'done',
          error: null,
        }),
      }
    }
    return {
      ok: true,
      data: await finishItem(runId, {
        runItemId: item.id,
        personaName: persona.name,
        status: 'in_progress',
        error: null,
      }),
    }
  } catch (err) {
    // Per-item skip-and-continue (not the run-fatal mapping used by single
    // actions): a failed step records its error and the loop moves on. The
    // run-level `failed` status is unused in v1.
    if (!(err instanceof LMStudioError)) throw err
    // Store only err.kind: err.message can embed the local LM Studio endpoint
    // URL, which must not leak into the DB or the UI. The client maps the
    // kind to a localized label.
    await markRunItemStatus(item.id, 'failed', err.kind)
    return {
      ok: true,
      data: await finishItem(
        runId,
        {
          runItemId: item.id,
          personaName: persona.name,
          status: 'failed',
          error: err.kind,
        },
        err.kind === 'http' ? 'error' : 'offline',
      ),
    }
  }
}

/**
 * Re-queues every failed run_item (error text cleared) so the client loop
 * can resume; a `done` run flips back to `in_progress`.
 */
export async function retryFailedRunItemsAction(
  runId: string,
): Promise<ActionResult<{retried: number}>> {
  // See runNextStepAction: arg shape-check before the gate/DB.
  if (!isShapedUuid(runId)) {
    return {ok: false, reason: 'validation'}
  }

  const noAccess = await requirePersonaInterviewAccess()
  if (noAccess) return noAccess

  const retried = await retryFailedRunItems(runId)
  return {ok: true, data: {retried}}
}

// ---------------------------------------------------------------------------
// Phase 6 — bulk persona drafting (server half)
// ---------------------------------------------------------------------------

export type PersonaCandidate = {
  id: string
  name: string
  region: string
  occupation: string | null
  backgroundTags: string[]
  personalitySliders: PersonalitySliders
  bio: string | null
  systemPrompt: string | null
}

const MIX_DESCRIPTION_MAX_CHARS = 2000
const BATCH_MIN_SIZE = 2
const BATCH_MAX_SIZE = 8
const BATCH_DEFAULT_SIZE = 5

/**
 * Map one validated AI draft onto a persisted candidate row. The draft
 * schema makes fields optional; the model is instructed to invent name and
 * region (shared core: empty fields MUST be invented), so these fallbacks
 * only fire on a degraded payload — they are not a normal path. The
 * hardcoded Vietnamese name fallback is accepted for now (no app-locale
 * plumbing reaches the drafting model). region stays '' because the
 * personas.region column is NOT NULL — persisting null is impossible
 * without a migration (owner-flagged finding).
 */
function draftToCandidateRow(draft: PersonaDraft) {
  return {
    name: draft.name ?? 'Nhân vật chưa đặt tên',
    locale: AI_DEFAULT_LOCALE,
    region: draft.region ?? '',
    gender: draft.gender,
    age: draft.age,
    incomeBracket: draft.incomeBracket,
    occupation: draft.occupation,
    backgroundTags: draft.backgroundTags ?? [],
    personalitySliders:
      draft.personalitySliders ??
      ({
        calm_anxious: 50,
        optimistic_cynical: 50,
        frugal_spendthrift: 50,
      } as PersonalitySliders),
    interviewStance: draft.interviewStance,
    quirksFreetext: draft.quirksFreetext,
    generatedBio: draft.bio,
    systemPrompt: draft.systemPrompt,
    status: 'draft' as const,
  }
}

function rowToCandidate(row: Persona): PersonaCandidate {
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    occupation: row.occupation,
    backgroundTags: row.backgroundTags,
    personalitySliders: row.personalitySliders,
    bio: row.generatedBio,
    systemPrompt: row.systemPrompt,
  }
}

/**
 * Draft arg shape-checks shared by generate/reroll: cheap, pure, run before
 * the access gate (house convention).
 */
type ActionFailure = Extract<ActionResult<never>, {ok: false}>

function parseMixDescriptionArg(
  rawMix: unknown,
): {ok: true; text: string} | ActionFailure {
  if (typeof rawMix !== 'string') {
    return {ok: false, reason: 'validation'}
  }
  const trimmed = rawMix.trim()
  if (trimmed.length === 0 || trimmed.length > MIX_DESCRIPTION_MAX_CHARS) {
    return {
      ok: false,
      reason: 'validation',
      message: `mixDescription must be 1-${MIX_DESCRIPTION_MAX_CHARS} characters`,
    }
  }
  return {ok: true, text: trimmed}
}

function parseBatchSizeArg(
  rawSize: unknown,
): {ok: true; size: number} | ActionFailure {
  if (rawSize === undefined) {
    return {ok: true, size: BATCH_DEFAULT_SIZE}
  }
  if (
    typeof rawSize !== 'number' ||
    !Number.isInteger(rawSize) ||
    rawSize < BATCH_MIN_SIZE ||
    rawSize > BATCH_MAX_SIZE
  ) {
    return {
      ok: false,
      reason: 'validation',
      message: `batchSize must be an integer between ${BATCH_MIN_SIZE} and ${BATCH_MAX_SIZE}`,
    }
  }
  return {ok: true, size: rawSize}
}

/**
 * Server-validated batch size: 2–8 candidates per call (default 5). The
 * diversity guard covers active personas AND unkept draft candidates (owner
 * decision — drafts count until kept, archived never does). All returned
 * candidates persist immediately as status='draft' rows; there is no
 * client-only candidate state. Fewer than N candidates is not an error —
 * the client loops and shows what came back.
 */
export async function generatePersonaCandidatesAction(
  raw: unknown,
): Promise<ActionResult<PersonaCandidate[]>> {
  const record =
    typeof raw === 'object' && raw !== null
      ? (raw as Record<string, unknown>)
      : undefined
  const mix = parseMixDescriptionArg(record?.mixDescription)
  if (!mix.ok) return mix
  const size = parseBatchSizeArg(record?.batchSize)
  if (!size.ok) return size

  const noAccess = await requirePersonaInterviewAccess()
  if (noAccess) return noAccess

  const guardSummary = await getDraftGuardRosterSummary()

  try {
    // Batch JSON is the biggest drafting payload; use the extended draft
    // timeout like the single generate path.
    const drafts = await draftPersonaBatch(mix.text, size.size, guardSummary, {
      timeoutMs: AI_DRAFT_TIMEOUT_MS,
    })
    // The shared draft schema is loose and can silently drop a degraded
    // candidate; an empty batch is a distinct outcome the client shows
    // instead of a confusing "success, nothing happened".
    if (drafts.length === 0) {
      return {ok: false, reason: 'noCandidates'}
    }
    // Defensive: the batch schema already bounds the array at count, but
    // never insert more than the validated batchSize.
    const inserted = await db
      .insert(personasTable)
      .values(drafts.slice(0, size.size).map(draftToCandidateRow))
      .returning()
    return {ok: true, data: inserted.map(rowToCandidate)}
  } catch (err) {
    const mapped = mapLMStudioError(err)
    if (mapped) return mapped
    throw err
  }
}

/**
 * Replaces one draft candidate with a single fresh draft. Refuses anything
 * that is not a transcript-less draft ('notDraft' / 'hasTranscripts') —
 * drafts hold no transcripts/run items by design, so the guard is the
 * safety net before a HARD delete (transcripts.persona_id and
 * run_items.persona_id have no ON DELETE cascade and there is no run-delete
 * path in v1).
 *
 * GENERATION-FIRST: the replacement is generated and inserted BEFORE the
 * old row is deleted — an offline/timeout failure must not leave the user
 * with nothing (the old draft survives). The guard summary EXCLUDES the
 * target persona so the new draft is not guarded against itself, and the
 * final delete re-checks status='draft' in the DELETE predicate (TOCTOU:
 * a concurrent flip to active/archived makes the delete a no-op → 0 rows
 * → 'notDraft'; the inserted replacement is cleaned up).
 */
export async function rerollPersonaCandidateAction(
  rawPersonaId: unknown,
  rawMix: unknown,
): Promise<ActionResult<PersonaCandidate>> {
  // Cheap arg shape-checks before the gate/DB.
  if (typeof rawPersonaId !== 'string' || !isShapedUuid(rawPersonaId)) {
    return {ok: false, reason: 'validation'}
  }
  const mix = parseMixDescriptionArg(rawMix)
  if (!mix.ok) return mix

  const noAccess = await requirePersonaInterviewAccess()
  if (noAccess) return noAccess

  const persona = await getPersonaById(rawPersonaId)
  if (!persona) {
    return {ok: false, reason: 'error', message: 'not found'}
  }
  if (persona.status !== 'draft') {
    return {ok: false, reason: 'notDraft'}
  }
  if (await personaHasTranscripts(persona.id)) {
    return {ok: false, reason: 'hasTranscripts'}
  }
  if (await personaHasRunItems(persona.id)) {
    return {ok: false, reason: 'hasTranscripts'}
  }

  // Summary BEFORE generation, target excluded: the rerolled candidate must
  // not guard against itself, but the rest of the roster + other drafts
  // still does. (Deletion happens last, so the exclusion is required here.)
  const guardSummary = await getDraftGuardRosterSummary({
    excludePersonaId: persona.id,
  })

  try {
    // Mix description rides the seedDescription hook — the shared template
    // treats that block as AUTHORITATIVE. Neutral sliders; the model
    // invents the rest (draftPersona re-validates through the loose schema).
    const seed = draftPersonaInputSchema.parse({
      locale: AI_DEFAULT_LOCALE,
      seedDescription: mix.text,
    })
    const draft = await draftPersona(seed, guardSummary, {
      timeoutMs: AI_DRAFT_TIMEOUT_MS,
    })
    const inserted = await db
      .insert(personasTable)
      .values(draftToCandidateRow(draft))
      .returning()
    const replacementId = inserted[0]!.id

    // Delete LAST (draft-only predicate re-verifies status at delete time).
    // 0 rows = concurrent status flip (TOCTOU): the replacement draft stays
    // harmless, but the reroll did not happen as requested — clean it up
    // and report 'notDraft' rather than silently mutating the roster.
    const deleted = await deleteDraftPersonaById(persona.id)
    if (deleted === 0) {
      await deleteDraftPersonaById(replacementId)
      return {ok: false, reason: 'notDraft'}
    }
    return {ok: true, data: rowToCandidate(inserted[0]!)}
  } catch (err) {
    const mapped = mapLMStudioError(err)
    if (mapped) return mapped
    throw err
  }
}

/**
 * Discards one draft candidate: same draft + no-transcripts guard, then a
 * draft-only hard delete (0 rows = concurrent status flip → 'notDraft').
 * Missing row = already discarded (idempotent retry), mirroring
 * deleteInterviewSessionAction. Deleting a persona with transcripts or run
 * items is refused ('hasTranscripts') — the FKs have no cascade, and there
 * is no run-delete path in v1, so those scenarios would 500 on the FK
 * violation; the guards are the safety net.
 */
export async function discardPersonaDraftAction(
  rawPersonaId: unknown,
): Promise<ActionResult<{deleted: boolean}>> {
  // Cheap arg shape-check before the gate/DB.
  if (typeof rawPersonaId !== 'string' || !isShapedUuid(rawPersonaId)) {
    return {ok: false, reason: 'validation'}
  }

  const noAccess = await requirePersonaInterviewAccess()
  if (noAccess) return noAccess

  const persona = await getPersonaById(rawPersonaId)
  if (!persona) {
    return {ok: true, data: {deleted: false}}
  }
  if (persona.status !== 'draft') {
    return {ok: false, reason: 'notDraft'}
  }
  if (await personaHasTranscripts(persona.id)) {
    return {ok: false, reason: 'hasTranscripts'}
  }
  if (await personaHasRunItems(persona.id)) {
    return {ok: false, reason: 'hasTranscripts'}
  }

  // Draft-only predicate re-verifies status at delete time (TOCTOU-safe);
  // 0 rows = concurrent flip to non-draft, reported as 'notDraft'.
  const deletedCount = await deleteDraftPersonaById(persona.id)
  if (deletedCount === 0) {
    return {ok: false, reason: 'notDraft'}
  }
  return {ok: true, data: {deleted: true}}
}
