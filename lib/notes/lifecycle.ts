import type {Note} from '~/db/schema/notes'

export const NOTE_RETENTION_SECONDS = 30 * 24 * 60 * 60
export type LifecycleNote = Note & {deadlineToken: string | null}

export type NoteMutationResult =
  | {status: 'success' | 'already_applied'; note: LifecycleNote}
  | {status: 'unavailable' | 'conflict' | 'invalid_input' | 'retryable_error'}

export function noteMutationSucceeded(
  result: NoteMutationResult,
): result is Extract<NoteMutationResult, {note: LifecycleNote}> {
  return result.status === 'success' || result.status === 'already_applied'
}
