import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { devices } from "./devices.ts";
import { users } from "./identity.ts";

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    eventType: text("event_type").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    deviceId: uuid("device_id").references(() => devices.id, {
      onDelete: "restrict",
    }),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    retentionUntil: timestamp("retention_until", {
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    index("audit_events_created_at_idx").on(table.createdAt),
    index("audit_events_event_type_created_at_idx").on(
      table.eventType,
      table.createdAt,
    ),
    index("audit_events_actor_user_id_created_at_idx").on(
      table.actorUserId,
      table.createdAt,
    ),
    index("audit_events_device_id_created_at_idx").on(
      table.deviceId,
      table.createdAt,
    ),
    index("audit_events_retention_until_idx").on(table.retentionUntil),
    check(
      "audit_events_retention_after_created",
      sql`${table.retentionUntil} > ${table.createdAt}`,
    ),
  ],
);
