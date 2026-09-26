import {z, type ZodError} from 'zod'
import {AI_DEFAULT_LOCALE, AI_LOCALES, type AiLocale} from '~/config/ai'
import type {FieldError} from '~/lib/ai/action-result'
import {personaStatusPgEnum} from '../../db/schema/personas'

export const personaInputSchema = z.object({
  name: z.string().min(1).max(100),
  // Optional without .default(): defaults are the form's job. Schema
  // defaults leaking into updatePersonaAction was a fixed bug — do not
  // reintroduce (see updatePersonaAction's raw-record guard).
  gender: z.string().max(50).optional(),
  age: z.coerce.number().int().min(1).max(120).optional(),
  locale: z
    .enum(Object.keys(AI_LOCALES) as AiLocale[])
    .default(AI_DEFAULT_LOCALE),
  region: z.string().min(1).max(50),
  incomeBracket: z.string().max(100).optional(),
  occupation: z.string().max(100).optional(),
  backgroundTags: z.array(z.string().min(1).max(100)).max(20).optional(),
  personalitySliders: z.object({
    calm_anxious: z.coerce.number().int().min(0).max(100),
    optimistic_cynical: z.coerce.number().int().min(0).max(100),
    frugal_spendthrift: z.coerce.number().int().min(0).max(100),
  }),
  interviewStance: z.string().max(200).optional(),
  quirksFreetext: z.string().max(2000).optional(),
  generatedBio: z.string().max(65535).optional(),
  systemPrompt: z.string().max(65535).optional(),
  status: z.enum(personaStatusPgEnum.enumValues).default('draft'),
})

export type PersonaInput = z.infer<typeof personaInputSchema>

/**
 * Loose schema for the AI-draft path: every field optional/lenient so an
 * empty draft form can be sent for full invention by the model. Slider
 * defaults (50) are WANTED here — an empty draft input must validate to
 * neutral sliders, unlike the strict save schema above.
 */
export const draftPersonaInputSchema = z.object({
  name: z.string().max(100).optional(),
  gender: z.string().max(50).optional(),
  age: z.coerce.number().int().min(1).max(120).optional(),
  locale: z
    .enum(Object.keys(AI_LOCALES) as AiLocale[])
    .default(AI_DEFAULT_LOCALE),
  region: z.string().max(50).optional(),
  incomeBracket: z.string().max(100).optional(),
  occupation: z.string().max(100).optional(),
  backgroundTags: z.array(z.string().min(1).max(100)).max(20).optional(),
  personalitySliders: z
    .object({
      calm_anxious: z.coerce.number().int().min(0).max(100).default(50),
      optimistic_cynical: z.coerce.number().int().min(0).max(100).default(50),
      frugal_spendthrift: z.coerce.number().int().min(0).max(100).default(50),
    })
    .prefault({}),
  interviewStance: z.string().max(200).optional(),
  quirksFreetext: z.string().max(2000).optional(),
  // Free-text seed from the researcher; generation-time input only — the
  // strict save schema must never persist it.
  seedDescription: z.string().min(1).max(10000).optional(),
})

export type DraftPersonaInput = z.infer<typeof draftPersonaInputSchema>

type ZodIssue = ZodError['issues'][number]

/**
 * Maps one Zod issue to a structured FieldError whose `key` is the i18n
 * message key and `params` feeds next-intl interpolation.
 */
function issueToFieldError(issue: ZodIssue): FieldError {
  switch (issue.code) {
    case 'invalid_type':
      // zod v4: invalid_type carries `input` (the received value), not
      // `received`. Missing/empty input means the field was absent.
      return issue.input === undefined || issue.input === ''
        ? {key: 'required'}
        : {key: 'invalid'}
    case 'too_small':
      return issue.origin === 'string'
        ? {key: 'minLength', params: {count: issue.minimum as number}}
        : {key: 'min', params: {count: issue.minimum as number}}
    case 'too_big':
      return issue.origin === 'string'
        ? {key: 'maxLength', params: {count: issue.maximum as number}}
        : {key: 'max', params: {count: issue.maximum as number}}
    case 'custom':
      return {
        key: issue.message,
        params: (issue.params ?? {}) as Record<string, string | number>,
      }
    default:
      return {key: 'invalid'}
  }
}

/** Flattens Zod issues into structured FieldErrors keyed by dotted path. */
export function toFieldErrors(error: ZodError): Record<string, FieldError[]> {
  const fieldErrors: Record<string, FieldError[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root'
    ;(fieldErrors[key] ??= []).push(issueToFieldError(issue))
  }
  return fieldErrors
}
