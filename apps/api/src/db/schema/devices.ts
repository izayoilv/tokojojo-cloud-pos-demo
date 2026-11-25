import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  deviceKeyStatusEnum,
  devicePlatformEnum,
  deviceStatusEnum,
} from "./enums.ts";
import { users } from "./identity.ts";

export const devices = pgTable(
  "devices",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    name: text("name").notNull(),
    platform: devicePlatformEnum("platform").notNull(),
    enrolledByUserId: uuid("enrolled_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: deviceStatusEnum("status").notNull().default("PENDING"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("devices_status_idx").on(table.status),
    index("devices_enrolled_by_user_id_idx").on(table.enrolledByUserId),
    index("devices_last_seen_at_idx").on(table.lastSeenAt),
    check("devices_name_not_blank", sql`btrim(${table.name}) <> ''`),
    check(
      "devices_revoked_fields_consistent",
      sql`(${table.status} = 'REVOKED' AND ${table.revokedAt} IS NOT NULL)
        OR (${table.status} <> 'REVOKED' AND ${table.revokedAt} IS NULL)`,
    ),
    check(
      "devices_active_requires_enrolled",
      sql`${table.status} <> 'ACTIVE' OR ${table.enrolledAt} IS NOT NULL`,
    ),
  ],
);

export const deviceKeys = pgTable(
  "device_keys",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "restrict" }),
    keyId: text("key_id").notNull().unique(),
    publicKey: text("public_key").notNull(),
    keyAlg: text("key_alg").notNull().default("Ed25519"),
    status: deviceKeyStatusEnum("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    acceptedUntil: timestamp("accepted_until", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("device_keys_one_active_per_device")
      .on(table.deviceId)
      .where(sql`${table.status} = 'ACTIVE'`),
    index("device_keys_device_id_status_idx").on(table.deviceId, table.status),
    check("device_keys_key_id_not_blank", sql`btrim(${table.keyId}) <> ''`),
    check(
      "device_keys_public_key_not_blank",
      sql`btrim(${table.publicKey}) <> ''`,
    ),
    check(
      "device_keys_status_fields_consistent",
      sql`(${table.status} = 'ACTIVE'
          AND ${table.retiredAt} IS NULL
          AND ${table.acceptedUntil} IS NULL
          AND ${table.revokedAt} IS NULL)
        OR (${table.status} = 'RETIRED'
          AND ${table.retiredAt} IS NOT NULL
          AND ${table.acceptedUntil} IS NOT NULL
          AND ${table.revokedAt} IS NULL)
        OR (${table.status} = 'REVOKED' AND ${table.revokedAt} IS NOT NULL)`,
    ),
    check(
      "device_keys_accepted_until_after_retired",
      sql`${table.acceptedUntil} IS NULL
        OR ${table.retiredAt} IS NULL
        OR ${table.acceptedUntil} > ${table.retiredAt}`,
    ),
  ],
);
