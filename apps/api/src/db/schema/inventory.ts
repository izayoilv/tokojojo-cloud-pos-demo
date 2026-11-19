import { sql } from "drizzle-orm";
import {
  check,
  decimal,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth.js";
import { products } from "./catalog.js";
import { tenants } from "./tenants.js";

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
  },
  (t) => [index("suppliers_tenant_idx").on(t.tenantId)],
);

export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "SALE",
  "RESTOCK",
  "ADJUSTMENT",
  "OPNAME",
  "RETURN",
]);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    type: stockMovementTypeEnum("type").notNull(),
    qty: decimal("qty", { precision: 12, scale: 2 }).notNull(),
    referenceId: uuid("reference_id"),
    expirationDate: timestamp("expiration_date", { withTimezone: true }),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("stock_movements_tenant_product_idx").on(t.tenantId, t.productId),
    index("stock_movements_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("stock_movements_reference_idx").on(t.referenceId),
    check("stock_movements_qty_nonzero", sql`${t.qty} <> 0`),
  ],
);
