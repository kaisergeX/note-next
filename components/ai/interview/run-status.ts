import type {RunStatus} from '~/db/schema/transcripts'
import type {BadgeStatus} from '~/components/ui/badge'

/**
 * Shared by run rows, the run detail header and the RunLoop item list.
 * RunItemStatus carries the same literal union as RunStatus, so one map
 * serves both run-level and item-level badges.
 */
export const RUN_STATUS_BADGE: Record<RunStatus, BadgeStatus> = {
  pending: 'neutral',
  in_progress: 'active',
  done: 'active',
  failed: 'archived',
}
