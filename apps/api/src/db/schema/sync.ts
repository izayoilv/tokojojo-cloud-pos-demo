import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { devices } from "./auth.js";
import { tenants } from "./tenants.js";

export const syncBatchStatusEnum = pgEnum("sync_batch_status", [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);

export const syncEventStatusEnum = pgEnum("sync_event_status", [
  "PENDING",
  "APPLIED",
  "SKIPPED",
  "FAILED",
]);

export const syncEventTypeEnum = pgEnum("sync_event_type", [
  "ORDER_CREATE",
  "STOCK_UPDATE",
  "DEBT_PAYMENT",
]);

export const syncBatches = pgTable(
  "sync_batches",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "restrict" }),
    clientBatchId: uuid("client_batch_id").notNull(),
    status: syncBatchStatusEnum("status").notNull().default("PENDING"),
    eventCount: bigint("event_count", { mode: "number" }).notNull().default(0),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    error: text("error"),
  },
  (t) => [
    uniqueIndex("sync_batches_tenant_device_batch_uq").on(
      t.tenantId,
      t.deviceId,
      t.clientBatchId,
    ),
    index("sync_batches_tenant_idx").on(t.tenantId),
    index("sync_batches_status_received_idx").on(t.status, t.receivedAt),
    check("sync_batches_event_count_nonnegative", sql`${t.eventCount} >= 0`),
  ],
);

export const deviceEvents = pgTable(
  "device_events",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "restrict" }),
    batchId: uuid("batch_id").references(() => syncBatches.id, {
      onDelete: "set null",
    }),
    clientEventId: uuid("client_event_id").notNull(),
    eventType: syncEventTypeEnum("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    payload: jsonb("payload").notNull(),
    status: syncEventStatusEnum("status").notNull().default("PENDING"),
    error: text("error"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("device_events_tenant_device_event_uq").on(
      t.tenantId,
      t.deviceId,
      t.clientEventId,
    ),
    index("device_events_batch_idx").on(t.batchId),
    index("device_events_status_created_idx").on(t.status, t.createdAt),
    index("device_events_tenant_device_status_idx").on(
      t.tenantId,
      t.deviceId,
      t.status,
    ),
  ],
);
