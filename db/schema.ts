import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const appStates = sqliteTable('app_states', {
  userId: text('user_id').primaryKey(),
  stateJson: text('state_json').notNull(),
  revision: integer('revision').notNull().default(1),
  updatedAt: text('updated_at').notNull(),
});
