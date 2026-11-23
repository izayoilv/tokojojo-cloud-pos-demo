import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { products, productUnits } from "./catalog.ts";
import {
  opnameStatusEnum,
  referenceTypeEnum,
  stockLocationEnum,
  stockMovementTypeEnum,
  stockTransferStatusEnum,
} from "./enums.ts";
import { users } from "./identity.ts";

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    location: stockLocationEnum("location").notNull(),
    qtyChange: numeric("qty_change", { precision: 12, scale: 3 }).notNull(),
    movementType: stockMovementTypeEnum("movement_type").notNull(),
    referenceType: referenceTypeEnum("reference_type").notNull(),
    referenceId: uuid("reference_id"),
    notes: text("notes"),
    flagged: boolean("flagged").notNull().default(false),
    flagReason: text("flag_reason"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("stock_movements_product_id_location_created_at_idx").on(
      table.productId,
      table.location,
      table.createdAt,
    ),
    index("stock_movements_reference_type_reference_id_idx").on(
      table.referenceType,
      table.referenceId,
    ),
    index("stock_movements_created_at_idx").on(table.createdAt),
    index("stock_movements_flagged_idx")
      .on(table.flagged)
      .where(sql`${table.flagged}`),
    check("stock_movements_qty_change_non_zero", sql`${table.qtyChange} <> 0`),
    check(
      "stock_movements_reference_consistency",
      sql`(${table.referenceType} = 'MANUAL' AND ${table.referenceId} IS NULL)
        OR (${table.referenceType} <> 'MANUAL' AND ${table.referenceId} IS NOT NULL)`,
    ),
    check(
      "stock_movements_flag_consistency",
      sql`${table.flagged} = (${table.flagReason} IS NOT NULL)`,
    ),
  ],
);

export const stockTransfers = pgTable(
  "stock_transfers",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    transferNo: text("transfer_no").notNull().unique(),
    fromLocation: stockLocationEnum("from_location").notNull(),
    toLocation: stockLocationEnum("to_location").notNull(),
    status: stockTransferStatusEnum("status").notNull().default("PENDING"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("stock_transfers_status_created_at_idx").on(
      table.status,
      table.createdAt,
    ),
    check(
      "stock_transfers_transfer_no_not_blank",
      sql`btrim(${table.transferNo}) <> ''`,
    ),
    check(
      "stock_transfers_distinct_locations",
      sql`${table.fromLocation} <> ${table.toLocation}`,
    ),
    check(
      "stock_transfers_review_fields_consistent",
      sql`(${table.status} = 'PENDING'
          AND ${table.reviewedBy} IS NULL
          AND ${table.reviewedAt} IS NULL
          AND ${table.completedAt} IS NULL
          AND ${table.cancelledBy} IS NULL
          AND ${table.cancelledAt} IS NULL)
        OR (${table.status} = 'COMPLETED'
          AND ${table.reviewedBy} IS NOT NULL
          AND ${table.reviewedAt} IS NOT NULL
          AND ${table.completedAt} IS NOT NULL
          AND ${table.cancelledBy} IS NULL
          AND ${table.cancelledAt} IS NULL)
        OR (${table.status} = 'CANCELLED'
          AND ${table.reviewedBy} IS NULL
          AND ${table.reviewedAt} IS NULL
          AND ${table.completedAt} IS NULL
          AND ${table.cancelledBy} IS NOT NULL
          AND ${table.cancelledAt} IS NOT NULL)`,
    ),
  ],
);

export const stockTransferItems = pgTable(
  "stock_transfer_items",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    transferId: uuid("transfer_id")
      .notNull()
      .references(() => stockTransfers.id, { onDelete: "restrict" }),
    productId: uuid("product_id").notNull(),
    productUnitId: uuid("product_unit_id").notNull(),
    qty: numeric("qty", { precision: 12, scale: 3 }).notNull(),
    qtyBase: numeric("qty_base", { precision: 12, scale: 3 }).notNull(),
  },
  (table) => [
    index("stock_transfer_items_transfer_id_idx").on(table.transferId),
    index("stock_transfer_items_product_id_idx").on(table.productId),
    foreignKey({
      name: "stock_transfer_items_product_unit_fk",
      columns: [table.productId, table.productUnitId],
      foreignColumns: [productUnits.productId, productUnits.id],
    }).onDelete("restrict"),
    check("stock_transfer_items_qty_positive", sql`${table.qty} > 0`),
    check("stock_transfer_items_qty_base_positive", sql`${table.qtyBase} > 0`),
  ],
);

export const stockOpnames = pgTable(
  "stock_opnames",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    opnameNo: text("opname_no").notNull().unique(),
    location: stockLocationEnum("location").notNull(),
    status: opnameStatusEnum("status").notNull().default("PENDING"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("stock_opnames_status_created_at_idx").on(
      table.status,
      table.createdAt,
    ),
    check(
      "stock_opnames_opname_no_not_blank",
      sql`btrim(${table.opnameNo}) <> ''`,
    ),
    check(
      "stock_opnames_review_fields_consistent",
      sql`(${table.status} = 'PENDING'
          AND ${table.reviewedBy} IS NULL
          AND ${table.reviewedAt} IS NULL)
        OR (${table.status} IN ('APPROVED', 'REJECTED')
          AND ${table.reviewedBy} IS NOT NULL
          AND ${table.reviewedAt} IS NOT NULL)`,
    ),
  ],
);

export const stockOpnameItems = pgTable(
  "stock_opname_items",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    opnameId: uuid("opname_id")
      .notNull()
      .references(() => stockOpnames.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    systemQty: numeric("system_qty", { precision: 12, scale: 3 }).notNull(),
    physicalQty: numeric("physical_qty", { precision: 12, scale: 3 }).notNull(),
    diffQty: numeric("diff_qty", { precision: 12, scale: 3 }).notNull(),
  },
  (table) => [
    index("stock_opname_items_opname_id_idx").on(table.opnameId),
    index("stock_opname_items_product_id_idx").on(table.productId),
    check(
      "stock_opname_items_physical_qty_non_negative",
      sql`${table.physicalQty} >= 0`,
    ),
    check(
      "stock_opname_items_diff_matches_quantities",
      sql`${table.diffQty} = ${table.physicalQty} - ${table.systemQty}`,
    ),
  ],
);
