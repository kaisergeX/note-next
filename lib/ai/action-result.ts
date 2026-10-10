/**
 * Structured, localizable field error: `key` doubles as the i18n message key,
 * `params` carries interpolation values (e.g. min/max counts, region list).
 * The Zod-issue → FieldError mapping lives in persona-validation.ts.
 */
export type FieldError = {
  key: string
  params?: Record<string, string | number>
}

export type ActionResult<T> =
  | {ok: true; data: T}
  | {
      ok: false
      reason:
        | 'validation'
        | 'no-access'
        | 'offline'
        | 'error'
        // Phase 6 draft-candidate guards: reroll/discard refuse non-draft
        // personas or personas that already hold transcripts/run items.
        | 'notDraft'
        | 'hasTranscripts'
        // Draft personas must be activated before an interview session can
        // start (startInterviewAction).
        | 'draftPersona'
      message?: string
      fieldErrors?: Record<string, FieldError[]>
    }
