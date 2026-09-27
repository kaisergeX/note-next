import type {RunStatus} from '~/db/schema/transcripts'

/**
 * Shared by run rows, the run detail header and the RunLoop item list.
 * RunItemStatus carries the same literal union as RunStatus, so one map
 * serves both run-level and item-level badges.
 */
export const RUN_STATUS_BADGE_CLASS: Record<RunStatus, string> = {
  pending: 'border-amber-500 text-amber-600 dark:text-amber-400',
  in_progress: 'border-sky-600 text-sky-600 dark:text-sky-400',
  done: 'border-green-600 text-green-600 dark:text-green-400',
  failed: 'border-red-600 text-red-600 dark:text-red-400',
}
