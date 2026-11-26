import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { devices } from "./devices.ts";
import { users } from "./identity.ts";

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    tokenHash: text("token_hash").notNull().unique(),
    csrfTokenHash: text("csrf_token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    userAgent: text("user_agent"),
    ip: text("ip"),
  },
  (table) => [
    index("sessions_user_id_expires_at_idx").on(table.userId, table.expiresAt),
    index("sessions_expires_at_idx").on(table.expiresAt),
    check(
      "sessions_expires_after_created",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "restrict" }),
    tokenHash: text("token_hash").notNull().unique(),
    familyId: uuid("family_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("refresh_tokens_device_id_idx").on(table.deviceId),
    index("refresh_tokens_family_id_idx").on(table.familyId),
    index("refresh_tokens_expires_at_idx").on(table.expiresAt),
  ],
);

export const offlineTokens = pgTable(
  "offline_tokens",
  {
    jti: uuid("jti").primaryKey(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "restrict" }),
    issuedToUserId: uuid("issued_to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    scope: text("scope").array().notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    graceUntil: timestamp("grace_until", { withTimezone: true }).notNull(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  },
  (table) => [
    index("offline_tokens_device_id_idx").on(table.deviceId),
    index("offline_tokens_expires_at_idx").on(table.expiresAt),
    check(
      "offline_tokens_scope_non_empty",
      sql`cardinality(${table.scope}) > 0`,
    ),
    check(
      "offline_tokens_grace_after_expiry",
      sql`${table.graceUntil} > ${table.expiresAt}`,
    ),
  ],
);

export const authNonces = pgTable(
  "auth_nonces",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    nonceHash: text("nonce_hash").notNull().unique(),
    deviceId: uuid("device_id")
      .notNull()
      .references(() => devices.id, { onDelete: "restrict" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("auth_nonces_device_id_expires_at_idx").on(
      table.deviceId,
      table.expiresAt,
    ),
    index("auth_nonces_expires_at_idx").on(table.expiresAt),
    check(
      "auth_nonces_expires_after_created",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);
