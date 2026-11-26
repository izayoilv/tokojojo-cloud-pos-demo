import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { devices } from "./devices.ts";
import { users } from "./identity.ts";

export const syncBatches = pgTable(
  "sync_batches",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "restrict" }),
    clientBatchId: uuid("client_batch_id").notNull(),
    batchHash: text("batch_hash").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    acceptedCount: integer("accepted_count").notNull().default(0),
    flaggedCount: integer("flagged_count").notNull().default(0),
    rejectedCount: integer("rejected_count").notNull().default(0),
  },
  (table) => [
    uniqueIndex("sync_batches_device_client_batch_unique").on(
      table.deviceId,
      table.clientBatchId,
    ),
    index("sync_batches_device_id_received_at_idx").on(
      table.deviceId,
      table.receivedAt,
    ),
    index("sync_batches_batch_hash_idx").on(table.batchHash),
    check(
      "sync_batches_counts_non_negative",
      sql`${table.acceptedCount} >= 0
        AND ${table.flaggedCount} >= 0
        AND ${table.rejectedCount} >= 0`,
    ),
  ],
);

export const deviceEvents = pgTable(
  "device_events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    metadata: jsonb("metadata")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("device_events_device_id_created_at_idx").on(
      table.deviceId,
      table.createdAt,
    ),
    index("device_events_type_created_at_idx").on(table.type, table.createdAt),
  ],
);
