import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** Drizzle table for the Postgres-first Hangar UI spine. */
export const contentSnapshots = pgTable('content_snapshots', {
  id: text('id').primaryKey(),
  payload: jsonb('payload').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const HANGAR_SPINE_SNAPSHOT_ID = 'hangar';
