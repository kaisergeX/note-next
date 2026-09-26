import type {ZodError} from 'zod'

export type ActionResult<T> =
  | {ok: true; data: T}
  | {
      ok: false
      reason: 'validation' | 'no-access' | 'offline' | 'error'
      message?: string
      fieldErrors?: Record<string, string[]>
    }

/** Flattens Zod issues into per-field message arrays keyed by dotted path. */
export function flattenFieldErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root'
    ;(fieldErrors[key] ??= []).push(issue.message)
  }
  return fieldErrors
}
