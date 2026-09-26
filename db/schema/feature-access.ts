import type {InferInsertModel, InferSelectModel} from 'drizzle-orm'
import {pgTable, primaryKey, text, timestamp, uuid} from 'drizzle-orm/pg-core'
import {usersTable} from './users'

export const featureAccessTable = pgTable(
  'feature_access',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id),
    feature: text('feature').notNull(),
    grantedAt: timestamp('granted_at', {withTimezone: true})
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({columns: [t.userId, t.feature]})],
)

export type FeatureAccess = InferSelectModel<typeof featureAccessTable>
export type NewFeatureAccess = InferInsertModel<typeof featureAccessTable>
