import 'server-only'

import {and, eq, type SQL} from 'drizzle-orm'
import {db} from '~/db/index'
import {
  featureAccessTable,
  type FeatureAccess,
} from '~/db/schema/feature-access'

export const AI_FEATURES = ['persona-interview', 'companion-chat'] as const
export type AIFeature = (typeof AI_FEATURES)[number]

/** Thrown when the user has no feature_access row for the requested feature. */
export class FeatureAccessError extends Error {
  constructor(public readonly feature: AIFeature) {
    super(`No feature_access row for feature "${feature}"`)
    this.name = 'FeatureAccessError'
  }
}

export async function requireFeatureAccess(
  userId: string,
  feature: AIFeature,
): Promise<FeatureAccess> {
  const where = and(
    eq(featureAccessTable.userId, userId),
    eq(featureAccessTable.feature, feature),
  ) as SQL

  const [row] = await db.select().from(featureAccessTable).where(where).limit(1)

  if (!row) {
    throw new FeatureAccessError(feature)
  }

  return row
}
